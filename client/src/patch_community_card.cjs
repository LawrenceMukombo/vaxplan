const fs = require('fs');
const path = require('path');

const filePath = path.join('C:', 'vaxplan', 'client', 'src', 'pages', 'Facilities.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const target = `                                          {route && (
                                            <div className="mt-2 space-y-1.5 text-xs text-muted-foreground border-t pt-2 border-muted/50">
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <Badge variant="outline" className="font-semibold text-foreground bg-background/50 border-primary/10">
                                                  {route.distanceToFacility.toFixed(2)} km
                                                </Badge>
                                                <span className="text-[11px] text-muted-foreground">`;

const replacement = `                                          {route && (
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
                                                  TTT:`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Success");
} else {
    console.log("Target not found. Please verify the exact string match.");
}
