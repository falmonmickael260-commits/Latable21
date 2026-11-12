"""Optional artist build: blender --background --python this_file -- base.obj output.glb.
Head topology: MakeHuman hm08, CC0 (2020), see assets/dealer/LICENSE-CC0.md.
The shipped GLB is prebuilt; Blender is not required to build or play the game.
"""
import bpy, sys, math
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:]; source,output=args
verts=[]; faces=[]; group=''
for line in open(source):
 if line.startswith('v '): verts.append(tuple(float(v) for v in line.split()[1:4]))
 elif line.startswith('g '): group=line.strip()[2:]
 elif line.startswith('f ') and group=='body':
  face=[int(v.split('/')[0])-1 for v in line.split()[1:]]
  if all(verts[i][1]>5.8 for i in face): faces.append(face)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def point(v): return (v[0]*.18,-(v[2]*.18-.09),v[1]*.18+1.5)
def material(name,color,rough=.65):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;return m
skin=material('Natural skin',(.52,.305,.195),.72); lips=material('Subtle lips',(.35,.14,.105),.8); hair=material('Combed dark hair',(.028,.019,.014),.66)
ids=sorted(set(i for f in faces for i in f));lookup={v:i for i,v in enumerate(ids)}
mesh=bpy.data.meshes.new('Anatomical head');mesh.from_pydata([point(verts[i]) for i in ids],[],[[lookup[i] for i in f] for f in faces]);mesh.update()
head=bpy.data.objects.new('DealerHead',mesh);bpy.context.collection.objects.link(head);head.data.materials.append(skin);head.data.materials.append(lips)
for p,f in zip(head.data.polygons,faces):
 p.use_smooth=True
 center=sum((Vector(verts[i]) for i in f),Vector())/len(f)
 if abs(center.x)<.28 and 6.45<center.y<6.64 and center.z>1.36:p.material_index=1
modifier=head.modifiers.new('Refined face curvature','SUBSURF');modifier.levels=1
# A close-fitted scalp follows the actual head surface rather than a spherical cap.
hair_faces=[f for f in faces if all(verts[i][1]>7.62+verts[i][2]*.14 for i in f)]
hair_ids=sorted(set(i for f in hair_faces for i in f));hm={v:i for i,v in enumerate(hair_ids)}
hv=[]
for i in hair_ids:
 p=Vector(point(verts[i]));d=p-Vector((0,.02,2.84));d.normalize();p+=d*.004;hv.append(p)
hmesh=bpy.data.meshes.new('Fitted hair');hmesh.from_pydata(hv,[],[[hm[i] for i in f] for f in hair_faces]);hmesh.update();ho=bpy.data.objects.new('Hair',hmesh);bpy.context.collection.objects.link(ho);ho.data.materials.append(hair)
for p in ho.data.polygons:p.use_smooth=True
mod=ho.modifiers.new('Smooth hairline','SUBSURF');mod.levels=1
white=material('Ivory sclera',(.72,.75,.70),.4);iris=material('Hazel iris',(.075,.048,.024),.38);pupil=material('Pupil',(.008,.01,.012),.3)
def sphere(name,location,radius,mat,scale=(1,1,1)):
 # Coordinates are given in Godot's Y-up space, converted for Blender's Z-up export.
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,radius=radius,location=(location[0],-location[2],location[1]));o=bpy.context.object;o.name=name;o.scale=(scale[0],scale[2],scale[1]);o.data.materials.append(mat)
 for p in o.data.polygons:p.use_smooth=True
for side in [-1,1]:
 x=side*.30775*.18;y=7.28415*.18+1.5;z=1.24535*.18-.09
 sphere('Eye', (x,y,z),.027,white)
 sphere('Iris',(x,y,z+.026),.010,iris,(1,1,.12))
 sphere('Pupil',(x,y,z+.0275),.0043,pupil,(1,1,.12))
 # Narrow eyebrows above the eyelid, with a gentle arch.
 curve=bpy.data.curves.new('Eyebrow','CURVE');curve.dimensions='3D';curve.bevel_depth=.0032;curve.bevel_resolution=2;spline=curve.splines.new('BEZIER');spline.bezier_points.add(2)
 for bp,xyz in zip(spline.bezier_points,[(side*.025,2.851,.178),(side*.058,2.859,.178),(side*.086,2.849,.164)]):bp.co=(xyz[0],-xyz[2],xyz[1]);bp.handle_left_type='AUTO';bp.handle_right_type='AUTO'
 obj=bpy.data.objects.new('Eyebrow',curve);bpy.context.collection.objects.link(obj);obj.data.materials.append(hair)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=output,export_format='GLB',export_yup=True,export_apply=True,export_materials='EXPORT')
print('Exported detailed CC0-derived dealer head',output)
