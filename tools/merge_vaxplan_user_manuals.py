from __future__ import annotations

import copy
import mimetypes
import shutil
import tempfile
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
REL = "http://schemas.openxmlformats.org/package/2006/relationships"
CT = "http://schemas.openxmlformats.org/package/2006/content-types"

NS = {"w": W, "r": R, "rel": REL, "ct": CT}
ET.register_namespace("w", W)
ET.register_namespace("r", R)
ET.register_namespace("wp", "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing")
ET.register_namespace("a", "http://schemas.openxmlformats.org/drawingml/2006/main")
ET.register_namespace("pic", "http://schemas.openxmlformats.org/drawingml/2006/picture")


BASE = Path(r"C:\vaxplan\VaxPlan_Comprehensive_User_Guide.docx")
APPEND = Path(r"C:\vaxplan\VaxPlan_User_Manual_Final.docx")
OUT = Path(r"C:\vaxplan\VaxPlan_Merged_User_Guide.docx")


def qn(ns: str, tag: str) -> str:
    return f"{{{ns}}}{tag}"


def unzip_docx(path: Path, dest: Path) -> None:
    with zipfile.ZipFile(path, "r") as zf:
        zf.extractall(dest)


def zip_docx(src_dir: Path, out_path: Path) -> None:
    if out_path.exists():
        out_path.unlink()
    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for item in sorted(src_dir.rglob("*")):
            if item.is_file():
                zf.write(item, item.relative_to(src_dir).as_posix())


def parse_xml(path: Path) -> ET.ElementTree:
    return ET.parse(path)


def rel_id_number(rel_id: str) -> int:
    if rel_id.startswith("rId") and rel_id[3:].isdigit():
        return int(rel_id[3:])
    return 0


def add_content_type(content_types_path: Path, part_name: str, content_type: str) -> None:
    tree = parse_xml(content_types_path)
    root = tree.getroot()
    for override in root.findall("ct:Override", NS):
        if override.attrib.get("PartName") == part_name:
            return
    override = ET.SubElement(root, qn(CT, "Override"))
    override.set("PartName", part_name)
    override.set("ContentType", content_type)
    tree.write(content_types_path, encoding="UTF-8", xml_declaration=True)


def image_content_type(name: str) -> str:
    guessed, _ = mimetypes.guess_type(name)
    return guessed or "application/octet-stream"


def next_media_name(media_dir: Path, original_name: str) -> str:
    suffix = Path(original_name).suffix or ".bin"
    existing = {p.name for p in media_dir.glob("*")}
    i = 1
    while True:
        candidate = f"merged_append_{i}{suffix}"
        if candidate not in existing:
            return candidate
        i += 1


def merge_relationships(base_dir: Path, append_dir: Path) -> dict[str, str]:
    base_rels_path = base_dir / "word" / "_rels" / "document.xml.rels"
    append_rels_path = append_dir / "word" / "_rels" / "document.xml.rels"
    base_rels = parse_xml(base_rels_path)
    append_rels = parse_xml(append_rels_path)
    base_root = base_rels.getroot()
    append_root = append_rels.getroot()

    max_rid = max(
        [rel_id_number(rel.attrib.get("Id", "")) for rel in base_root.findall("rel:Relationship", NS)]
        or [0]
    )
    media_dir = base_dir / "word" / "media"
    media_dir.mkdir(parents=True, exist_ok=True)
    content_types_path = base_dir / "[Content_Types].xml"
    rid_map: dict[str, str] = {}

    for rel in append_root.findall("rel:Relationship", NS):
        old_id = rel.attrib.get("Id")
        rel_type = rel.attrib.get("Type", "")
        target = rel.attrib.get("Target", "")
        if not old_id:
            continue
        if not (
            "image" in rel_type
            or "hyperlink" in rel_type
            or "oleObject" in rel_type
            or "package" in rel_type
        ):
            continue

        max_rid += 1
        new_id = f"rId{max_rid}"
        rid_map[old_id] = new_id

        new_rel = copy.deepcopy(rel)
        new_rel.set("Id", new_id)

        if "image" in rel_type and not target.startswith(("http://", "https://")):
            source = (append_dir / "word" / target).resolve()
            new_name = next_media_name(media_dir, Path(target).name)
            target = f"media/{new_name}"
            shutil.copyfile(source, media_dir / new_name)
            add_content_type(
                content_types_path,
                f"/word/media/{new_name}",
                image_content_type(new_name),
            )
            new_rel.set("Target", target)

        base_root.append(new_rel)

    base_rels.write(base_rels_path, encoding="UTF-8", xml_declaration=True)
    return rid_map


def remap_relationship_ids(element: ET.Element, rid_map: dict[str, str]) -> None:
    for node in element.iter():
        for attr_name, attr_value in list(node.attrib.items()):
            if attr_value in rid_map and (
                attr_name.endswith("}embed")
                or attr_name.endswith("}link")
                or attr_name.endswith("}id")
            ):
                node.set(attr_name, rid_map[attr_value])


def separator_elements() -> list[ET.Element]:
    page_break = ET.fromstring(
        f'<w:p xmlns:w="{W}"><w:r><w:br w:type="page"/></w:r></w:p>'
    )
    heading = ET.fromstring(
        f'<w:p xmlns:w="{W}">'
        '<w:pPr><w:pStyle w:val="Heading1"/></w:pPr>'
        "<w:r><w:t>Appendix: Previous Final Manual</w:t></w:r>"
        "</w:p>"
    )
    note = ET.fromstring(
        f'<w:p xmlns:w="{W}">'
        "<w:r><w:t>This appendix preserves the content from VaxPlan_User_Manual_Final.docx for continuity after the comprehensive guide.</w:t></w:r>"
        "</w:p>"
    )
    return [page_break, heading, note]


def append_body(base_dir: Path, append_dir: Path, rid_map: dict[str, str]) -> None:
    base_doc_path = base_dir / "word" / "document.xml"
    append_doc_path = append_dir / "word" / "document.xml"
    base_tree = parse_xml(base_doc_path)
    append_tree = parse_xml(append_doc_path)
    base_body = base_tree.getroot().find("w:body", NS)
    append_body_el = append_tree.getroot().find("w:body", NS)
    if base_body is None or append_body_el is None:
        raise RuntimeError("Could not find document body in one of the source files.")

    base_sect = base_body.find("w:sectPr", NS)
    if base_sect is not None:
        base_body.remove(base_sect)

    for element in separator_elements():
        base_body.append(element)

    for child in list(append_body_el):
        if child.tag == qn(W, "sectPr"):
            continue
        cloned = copy.deepcopy(child)
        remap_relationship_ids(cloned, rid_map)
        base_body.append(cloned)

    if base_sect is not None:
        base_body.append(base_sect)

    base_tree.write(base_doc_path, encoding="UTF-8", xml_declaration=True)


def main() -> None:
    if not BASE.exists():
        raise FileNotFoundError(BASE)
    if not APPEND.exists():
        raise FileNotFoundError(APPEND)

    with tempfile.TemporaryDirectory(prefix="vaxplan_merge_") as tmp:
        tmp_dir = Path(tmp)
        base_dir = tmp_dir / "base"
        append_dir = tmp_dir / "append"
        unzip_docx(BASE, base_dir)
        unzip_docx(APPEND, append_dir)
        rid_map = merge_relationships(base_dir, append_dir)
        append_body(base_dir, append_dir, rid_map)
        zip_docx(base_dir, OUT)

    print(OUT)
    print(OUT.stat().st_size)


if __name__ == "__main__":
    main()
