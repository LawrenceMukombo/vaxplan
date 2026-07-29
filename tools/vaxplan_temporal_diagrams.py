from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
out = Path(r'C:\vaxplan\Diagrams\temporal')
out.mkdir(parents=True, exist_ok=True)
try:
    font_bold = ImageFont.truetype('arialbd.ttf', 26)
    font = ImageFont.truetype('arial.ttf', 18)
    font_small = ImageFont.truetype('arial.ttf', 14)
except Exception:
    font_bold = font = font_small = ImageFont.load_default()
NAVY=(15,35,62); TEAL=(0,139,173); GREEN=(0,138,101); ORANGE=(190,105,0); RED=(190,55,70); BORDER=(187,201,214); BG=(250,253,255); TEXT=(31,42,55); MUTED=(95,108,120)
def box(draw, xy, title, body='', fill=(255,255,255), outline=BORDER, accent=TEAL):
    x1,y1,x2,y2=xy
    draw.rounded_rectangle(xy, radius=14, fill=fill, outline=outline, width=2)
    draw.rectangle((x1,y1,x1+8,y2), fill=accent)
    draw.text((x1+22,y1+16), title, font=font_bold, fill=TEXT)
    lines=[]
    for part in body.split('\n'):
        while len(part)>52:
            cut=part.rfind(' ',0,52)
            if cut<15: cut=52
            lines.append(part[:cut])
            part=part[cut:].strip()
        if part: lines.append(part)
    yy=y1+55
    for line in lines[:5]:
        draw.text((x1+22,yy), line, font=font_small, fill=MUTED)
        yy+=22
def arrow(draw, a, b, color=TEAL):
    ax,ay=a; bx,by=b
    draw.line((ax,ay,bx,by), fill=color, width=4)
    import math
    ang=math.atan2(by-ay,bx-ax); l=14
    pts=[(bx,by),(bx-l*math.cos(ang-0.45),by-l*math.sin(ang-0.45)),(bx-l*math.cos(ang+0.45),by-l*math.sin(ang+0.45))]
    draw.polygon(pts, fill=color)
def save_flow():
    img=Image.new('RGB',(1500,850),BG); d=ImageDraw.Draw(img)
    d.text((60,40),'VaxPlan Temporal Data Flow',font=font_bold,fill=NAVY)
    d.text((60,76),'Bitemporal change capture, approval, activation, and as-of reporting.',font=font,fill=MUTED)
    boxes=[((70,170,360,330),'User or Import Source','Facility edit, staff update, boundary upload, population import, or role change.',TEAL),((450,170,740,330),'Temporal Draft','Stable entity id, valid dates, snapshot, source, reason, and affected records.',ORANGE),((830,170,1120,330),'Review and Approval','Permission-gated review for current, future, correction, or retroactive changes.',GREEN),((1210,170,1450,330),'Version Store','Active, scheduled, corrected, cancelled, and superseded records are preserved.',NAVY),((450,510,740,690),'Audit Trail','Immutable temporal audit events record who changed what and when.',NAVY),((830,510,1120,690),'As-of Services','Reconstruct valid-time or system-time state for reports and users.',TEAL),((1210,510,1450,690),'UI Workbench','Current, history, future, comparison, and as-of views.',GREEN)]
    for xy,title,body,accent in boxes: box(d,xy,title,body,accent=accent)
    arrow(d,(360,250),(450,250)); arrow(d,(740,250),(830,250)); arrow(d,(1120,250),(1210,250)); arrow(d,(970,330),(970,510)); arrow(d,(1330,330),(1330,510)); arrow(d,(740,600),(830,600)); arrow(d,(1120,600),(1210,600))
    img.save(out/'vaxplan-temporal-data-flow.png')
def save_state():
    img=Image.new('RGB',(1500,850),BG); d=ImageDraw.Draw(img)
    d.text((60,40),'VaxPlan Bitemporal State Model',font=font_bold,fill=NAVY)
    d.text((60,76),'Every governed record moves through workflow states without destructive deletion.',font=font,fill=MUTED)
    nodes={'Draft':(120,210,330,310,TEAL),'Pending Approval':(460,210,730,310,ORANGE),'Active':(880,140,1090,240,GREEN),'Scheduled Future':(880,300,1130,400,TEAL),'Rejected':(470,500,690,600,RED),'Superseded':(1210,140,1420,240,NAVY),'Corrected':(1210,300,1420,400,ORANGE),'Cancelled':(1210,500,1420,600,RED)}
    for title,(x1,y1,x2,y2,accent) in nodes.items(): box(d,(x1,y1,x2,y2),title,accent=accent)
    arrow(d,(330,260),(460,260)); arrow(d,(730,250),(880,190),GREEN); arrow(d,(730,280),(880,350),TEAL); arrow(d,(590,310),(590,500),RED); arrow(d,(1090,190),(1210,190),NAVY); arrow(d,(1090,240),(1210,350),ORANGE); arrow(d,(1130,350),(1210,550),RED)
    d.text((105,365),'Valid time: real-world effective dates',font=font,fill=TEXT)
    d.text((105,400),'System time: when VaxPlan recorded/trusted the version',font=font,fill=TEXT)
    d.text((105,435),'Status: draft, pending, active, scheduled, corrected, cancelled, superseded, rejected',font=font,fill=TEXT)
    img.save(out/'vaxplan-bitemporal-state-model.png')
def save_schema():
    img=Image.new('RGB',(1500,900),BG); d=ImageDraw.Draw(img)
    d.text((60,40),'VaxPlan Temporal Schema Overview',font=font_bold,fill=NAVY)
    d.text((60,76),'Additive enterprise tables layered over existing operational modules.',font=font,fill=MUTED)
    box(d,(590,230,910,430),'temporal_entity_versions','Generic bitemporal snapshots for governed entities: facilities, boundaries, settlements, reference data.',accent=NAVY)
    surrounding=[((80,170,380,330),'temporal_change_requests','Approval workflow, retroactive flag, impact assessment.',ORANGE),((80,500,380,660),'temporal_audit_events','Immutable action log and before/after snapshots.',TEAL),((590,570,910,750),'temporal_entity_lineage','Split, merge, replacement, reparenting, transfer.',GREEN),((1120,120,1430,280),'temporal_role_assignments','User role, scope, and permission history.',TEAL),((1120,320,1430,480),'temporal_employment_assignments','Staff facility and geography posting history.',GREEN),((1120,520,1430,680),'temporal_geography_versions','Admin hierarchy, names, codes, and geometry history.',NAVY),((590,120,910,180),'temporal_population_denominators','Reference-year population estimates and approvals.',ORANGE)]
    for xy,title,body,accent in surrounding: box(d,xy,title,body,accent=accent)
    arrow(d,(380,250),(590,300)); arrow(d,(380,580),(590,360)); arrow(d,(750,570),(750,430)); arrow(d,(1120,200),(910,280)); arrow(d,(1120,400),(910,340)); arrow(d,(1120,600),(910,390)); arrow(d,(750,180),(750,230))
    img.save(out/'vaxplan-temporal-schema-overview.png')
save_flow(); save_state(); save_schema()
print(out)
