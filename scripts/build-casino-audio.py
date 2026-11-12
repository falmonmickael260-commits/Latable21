"""Generate original, nonverbal casino ambience and acoustic-style effects (standard library only)."""
import math,random,wave,struct,os
RATE=22050;out=os.path.join(os.path.dirname(__file__),'../godot/assets/sounds');os.makedirs(out,exist_ok=True)
def save(name,values):
 with wave.open(os.path.join(out,name),'wb') as w:
  w.setparams((1,2,RATE,len(values),'NONE','not compressed'));w.writeframes(b''.join(struct.pack('<h',int(max(-1,min(1,x))*32760)) for x in values))
rng=random.Random(21021);samples=[];low=0
for i in range(int(RATE*.18)):
 t=i/RATE;n=rng.uniform(-1,1);low=.65*low+.35*n;brush=n-low
 env=(1-math.exp(-t*120))*math.exp(-t*23)
 tap=math.sin(2*math.pi*170*t)*math.exp(-max(0,t-.105)*120)*(.1 if t>.105 else 0)
 samples.append(brush*env*.48+tap)
save('card-slide.wav',samples)
samples=[]
for i in range(int(RATE*.16)):
 t=i/RATE;transient=rng.uniform(-1,1)*math.exp(-t*260)
 ring=sum(math.sin(2*math.pi*f*t)*math.exp(-t*d)*a for f,d,a in [(1810,47,.27),(2730,62,.15),(4120,95,.07)])
 samples.append((transient*.25+ring)*(1-math.exp(-t*2400)))
save('clay-chip.wav',samples)
length=RATE*12;samples=[];slow=0;mid=0
for i in range(length):
 t=i/RATE;n=rng.uniform(-1,1);slow=.995*slow+.005*n;mid=.85*mid+.15*n
 envelope=.55+.17*math.sin(2*math.pi*t/12)+.12*math.sin(2*math.pi*t/3)
 bed=(slow*.65+mid*.13)*envelope
 # Very distant, sparse clay clinks; no music, speech or identifiable recording.
 for onset in [1.3,4.8,8.6,10.2]:
  dt=t-onset
  if 0<dt<.15:bed+=math.sin(2*math.pi*2140*dt)*math.exp(-dt*65)*.018
 samples.append(bed)
# Smooth the loop join without a click.
fade=RATE//8
for i in range(fade):
 u=i/fade;samples[-fade+i]=samples[-fade+i]*(1-u)+samples[i]*u
save('salon-ambience.wav',samples)
