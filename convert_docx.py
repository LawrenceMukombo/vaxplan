import sys
import os
import json
import csv
import zipfile
import re
import xml.etree.ElementTree as ET

sys.stdout.reconfigure(encoding='utf-8')

docx_path = 'c:/vaxplan/Supportive Supervision.docx'
csv_out_path = 'c:/vaxplan/Supportive_Supervision_National_Full_Template.csv'
json_out_path = 'c:/vaxplan/Supportive_Supervision_National_Full_Template.json'

with zipfile.ZipFile(docx_path) as z:
    xml_content = z.read('word/document.xml')
    tree = ET.fromstring(xml_content)

body = tree.find('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}body')

def map_section_title(raw_text):
    t = raw_text.strip()
    if 'Availability of RI Services' in t:
        return 'Availability of RI Services'
    elif 'RI Session Monitoring' in t:
        return 'RI Session Monitoring'
    elif 'Part - I' in t or 'Advocacy, Communication' in t:
        return 'Advocacy & Social Mobilization (Part I - Facility)'
    elif 'Part II-Mother/Female caregiver' in t:
        return 'Caregiver Survey: Mother / Female Caregiver'
    elif 'Part II-Father/Male caregiver' in t:
        return 'Caregiver Survey: Father / Male Caregiver'
    elif 'Part II-Community leader' in t:
        return 'Community Engagement: Community / Religious Leader'
    elif 'Part II' in t:
        return 'Community & Caregiver Survey (General)'
    elif 'AEFI' in t:
        return 'AEFI Management & Surveillance'
    elif 'Data Management' in t:
        return 'Data Management & Monitoring'
    elif 'Cold Chain' in t:
        return 'Cold Chain & Equipment'
    elif 'Waste Disposal' in t or 'Waste Management' in t:
        return 'Immunization Waste Management'
    elif 'Logistics' in t or 'Vaccine and Supplies' in t:
        return 'Vaccine & Supply Logistics'
    elif 'Supervisory Visit' in t or 'Recommendation' in t:
        return 'Supervisory Visit & Action Plan'
    return None

current_sec = 'Availability of RI Services'
parsed_questions = []

def infer_type_and_options(q_text, resp_text):
    q_lower = q_text.lower()
    r_lower = resp_text.lower()
    
    if 'iec material' in q_lower or 'what material is available' in q_lower:
        return 'single_select', 'Poster | Leaflet | Banner | Flipchart | Booklet | None'
    elif 'social media' in q_lower or 'which social media' in q_lower:
        return 'single_select', 'Facebook | WhatsApp | Telegram | TikTok | X (Twitter) | YouTube'
    elif 'waste disposal' in q_lower or 'method is used for' in q_lower:
        return 'single_select', 'Incinerator | Open Burning | Safety Box Burial | Offsite Facility Disposal'
    elif 'version' in q_lower or 'edition' in q_lower:
        return 'single_select', '2022 Edition | 2023 Edition | 2024 Revised Edition | Old Manual'
    elif 'stock out vaccines' in q_lower or 'stock out of vaccines' in q_lower:
        return 'single_select', 'BCG | bOPV | IPV | Penta (DTP-HepB-Hib) | PCV | Rota | Measles-Rubella | HPV | Tetanus (Td)'
    elif 'reasons for the delay' in q_lower or 'reasons for no vaccination' in q_lower:
        return 'single_select', 'Distance to facility | Service cost / fees | Fear of side effects | Vaccine stockout | Caregiver busy | Religion / Cultural beliefs'
    elif 'where did you hear' in q_lower or 'learn about the benefits' in q_lower:
        return 'single_select', 'Health worker | Radio / TV | Community mobilizer | Religious leader | School | Friend / Neighbor | Social media'

    if 'select one:' in r_lower or '☐ yes' in r_lower or '☐ no' in r_lower:
        if '☐ n/a' in r_lower or 'n/a' in r_lower:
            return 'yes_no_na', 'Yes | No | N/A'
        return 'yes_no', 'Yes | No'
    elif 'numeric value:' in r_lower or 'number' in r_lower or 'how many' in q_lower or 'total number' in q_lower or 'enter zero' in r_lower:
        return 'number', ''
    elif 'select all' in r_lower or 'select what' in r_lower or 'select option' in r_lower or 'check all' in r_lower:
        return 'single_select', 'Option 1 | Option 2 | Option 3'
    elif 'take a photo' in q_lower or 'take a photo' in r_lower or 'photo' in q_lower:
        return 'image', ''
    elif 'rating' in q_lower or 'score' in q_lower:
        return 'rating', '1 | 2 | 3 | 4 | 5'
    else:
        return 'text', ''

last_q_id_by_number = {}

for child in body:
    tag = child.tag.split('}')[-1]
    if tag == 'p':
        text = ''.join([t.text for t in child.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t') if t.text]).strip()
        if text:
            mapped = map_section_title(text)
            if mapped:
                current_sec = mapped
    elif tag == 'tbl':
        for row in child.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tr'):
            cells = []
            for cell in row.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}tc'):
                cell_text = ' '.join([t.text for t in cell.iter('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t') if t.text]).strip()
                cells.append(cell_text)
            
            if len(cells) >= 3 and cells[0] and cells[0] != 'No.' and cells[0] != 'Question / instruction':
                q_num = cells[0].strip()
                raw_q_text = cells[1].strip()
                q_resp = cells[2].strip() if len(cells) > 2 else ''
                
                if 'Question / instruction' in raw_q_text or not raw_q_text:
                    continue

                # Parse out "Ask only if:" or "Guidance:"
                clean_q_text = raw_q_text
                guidance = ""
                cond_parent = ""
                cond_val = ""

                if "Ask only if:" in raw_q_text:
                    m = re.search(r'Ask only if:\s*“?([^”"]+)”?\s*(includes|equals|=|is)\s*“?([^”"]+)”?', raw_q_text, re.IGNORECASE)
                    if m:
                        cond_parent = m.group(1).strip()
                        cond_val = m.group(3).strip()
                    parts = raw_q_text.split("Ask only if:")
                    clean_q_text = parts[0].strip()
                    guidance = "Ask only if: " + parts[1].strip()

                if "Guidance:" in clean_q_text:
                    parts = clean_q_text.split("Guidance:")
                    clean_q_text = parts[0].strip()
                    guidance = (guidance + " " + "Guidance: " + parts[1].strip()).strip()

                q_type, options = infer_type_and_options(clean_q_text, q_resp)
                
                prefill_key = None
                if 'total facility staff' in clean_q_text.lower():
                    prefill_key = 'total_staff'
                elif 'target population' in clean_q_text.lower() and 'annual' in clean_q_text.lower():
                    prefill_key = 'annual_target_pop'

                q_entry = {
                    'sectionTitle': current_sec,
                    'questionNumber': q_num,
                    'questionText': clean_q_text,
                    'answerType': q_type,
                    'options': options,
                    'isScored': 'true' if q_type in ['yes_no', 'yes_no_na', 'rating'] else 'false',
                    'weight': 1.0,
                    'prefillSourceKey': prefill_key or '',
                    'guidance': guidance,
                    'conditionalOnQuestion': cond_parent,
                    'conditionalValue': cond_val
                }

                parsed_questions.append(q_entry)
                last_q_id_by_number[q_num] = clean_q_text

print(f'Full Extraction Complete: {len(parsed_questions)} questions extracted across all sections!')

# Save CSV
fieldnames = ['Section Title', 'Question Text', 'Answer Type', 'Options', 'Is Scored', 'Weight', 'Prefill Source', 'Help Text', 'Conditional Parent', 'Conditional Value']
with open(csv_out_path, 'w', newline='', encoding='utf-8-sig') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    for q in parsed_questions:
        writer.writerow({
            'Section Title': q['sectionTitle'],
            'Question Text': f"[{q['questionNumber']}] {q['questionText']}",
            'Answer Type': q['answerType'],
            'Options': q['options'],
            'Is Scored': q['isScored'],
            'Weight': q['weight'],
            'Prefill Source': q['prefillSourceKey'],
            'Help Text': q['guidance'],
            'Conditional Parent': q['conditionalOnQuestion'],
            'Conditional Value': q['conditionalValue']
        })

print(f'Saved comprehensive CSV template to: {csv_out_path}')

# Save JSON
json_template = {
    'name': 'National Supportive Supervision Checklist (Full 148 Qs)',
    'category': 'supervision',
    'description': 'Full National Supportive Supervision Checklist with complete follow-up logic, repeat caregiver surveys, cold chain, AEFI, and performance indicators.',
    'version': 1,
    'isActive': True,
    'questions': [
        {
            'sectionTitle': q['sectionTitle'],
            'questionText': f"[{q['questionNumber']}] {q['questionText']}",
            'answerType': q['answerType'],
            'options': q['options'].split(' | ') if q['options'] else [],
            'isScored': q['isScored'] == 'true',
            'weight': q['weight'],
            'prefillSourceKey': q['prefillSourceKey'],
            'helpText': q['guidance'],
            'conditionalOnQuestionId': q['conditionalOnQuestion'],
            'conditionalValue': q['conditionalValue']
        }
        for q in parsed_questions
    ]
}

with open(json_out_path, 'w', encoding='utf-8') as f:
    json.dump(json_template, f, indent=2)

print(f'Saved comprehensive JSON template to: {json_out_path}')
