import re

file_path = r"C:\vaxplan\client\src\pages\Facilities.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

target = """                                          {route && (
                                            <div className="mt-2 space-y-1.5 text-xs text-muted-foreground border-t pt-2 border-muted/50">
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <Badge variant="outline" className="font-semibold text-foreground bg-background/50 border-primary/10">
                                                  {route.distanceToFacility.toFixed(2)} km
                                                </Badge>
                                                <span className="text-[11px] text-muted-foreground">"""

replacement = """                                          {route && (
                                            <div className="mt-2 space-y-1.5 text-xs text-muted-foreground border-t pt-2 border-muted/50">
                                              <div className="flex flex-col gap-1 mb-1">
                                                <span className="text-[11px] font-medium text-foreground">
                                                  Linked HF: <span className="font-semibold text-primary">{editingFacility?.name || "Unknown"}</span>
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <Badge variant="outline" className="font-semibold text-foreground bg-background/50 border-primary/10">
                                                  Distance: {route.distanceToFacility.toFixed(2)} km
                                                </Badge>
                                                <span className="text-[11px] text-muted-foreground font-medium">
                                                  TTT:"""

if target in content:
    content = content.replace(target, replacement)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Success")
else:
    print("Target not found. Please verify the exact string match.")
