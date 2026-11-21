"""Diffuse patch radiosity for the gallery's two roof lights and west garden window.
Coordinates use metres, +Y up. Store RGB irradiance in a linear atlas."""
from pathlib import Path
import numpy as np
from PIL import Image
import sys
out=Path(sys.argv[1])
def grid(face,w,h):
 u,v=np.meshgrid((np.arange(w)+.5)/w,(np.arange(h)+.5)/h)
 u=u.ravel();v=v.ravel(); ones=np.ones_like(u);zero=ones*0
 if face==0: coords=(12*u-6,zero,14*v-7);norm=(zero,ones,zero);area=168*ones
 if face in (1,2): coords=(12*u-6,5.25*v,ones*(-7 if face==1 else 7));norm=(zero,zero,ones*(1 if face==1 else -1));area=63*ones
 if face in (3,4): coords=(ones*(-6 if face==3 else 6),5.25*v,14*u-7);norm=(ones*(1 if face==3 else -1),zero,zero);area=73.5*ones
 if face in (5,6):
  x=6*u-3; curvature=1.33; y=5.18-curvature*(x/3)**2; slope=-2*curvature*x/9
  coords=(x+(-3 if face==5 else 3),y,14*v-7);norm=(slope,-ones,zero);area=84*np.sqrt(1+slope*slope)
 n=np.stack(norm,1);n/=np.linalg.norm(n,axis=1)[:,None]
 return np.stack(coords,1),n,area/(w*h)
def power(p,face):
 x,y,z=p.T
 if face==3:return ((z>-6.55)&(z<-2.45)&(y>.42)&(y<3.54))[:,None]*np.array([6.6,7.4,8.0])
 if face in (5,6):
  center=-3 if face==5 else 3
  return (np.abs(x-center)<.35)[:,None]*np.array([5.,5.35,5.7])
 return np.zeros_like(p)
def sun(p,n):
 # Back-project the area of the courtyard glazing along a low afternoon sun vector.
 ray=np.array([-1.,.66,-.36]);t=(p[:,0]+6);hit=p+t[:,None]*ray;_,y,z=hit.T
 def edge(d):return np.clip(.5+d/(.074+.024*t),0,1)
 trans=edge(y-.42)*edge(3.54-y)*edge(z+6.55)*edge(-2.45-z)
 for mullion in (-5.18,-3.82):trans*=1-np.clip((.045+.014*t-np.abs(z-mullion))/(.036+.026*t),0,1)*.82
 return trans[:,None]*np.maximum(n@(ray/np.linalg.norm(ray)),0)[:,None]*np.array([3.3,2.62,1.83])
coarse=[grid(i,20,16) for i in range(7)]
P,N,A=(np.concatenate([g[k] for g in coarse]) for k in range(3))
def form(p,n):
 d=P[None,:,:]-p[:,None,:];r=np.sum(d*d,axis=2)
 left=np.maximum(np.einsum('ijk,ik->ij',d,n),0);right=np.maximum(-np.einsum('ijk,jk->ij',d,N),0)
 return left*right*A/(np.pi*(r+.10)*(r+.10))
F=np.concatenate([form(P[i:i+48],N[i:i+48]) for i in range(0,len(P),48)])
F/=np.maximum(F.sum(1),1)[:,None]
emit=np.concatenate([power(g[0],i) for i,g in enumerate(coarse)])
rho=np.repeat([[.51,.48,.43]]+[[.77,.74,.69]]*6,320,axis=0)
direct=sun(P,N);B=emit.copy()
for _ in range(4):B=emit+rho*(F@B+direct)
atlas=Image.new('RGB',(1024,512))
for face in range(7):
 # Indirect illumination varies slowly. Evaluate at 48²; sample sunlight at atlas resolution.
 p,n,_=grid(face,48,48);ind=np.concatenate([form(p[i:i+48],n[i:i+48])@B for i in range(0,len(p),48)])
 ind=ind.reshape(48,48,3)
 light=np.stack([np.asarray(Image.fromarray(ind[:,:,c].astype('float32')).resize((256,256),Image.Resampling.BICUBIC)) for c in range(3)],axis=-1)
 p,n,_=grid(face,256,256);light+=sun(p,n).reshape(256,256,3)
 img=Image.fromarray(np.uint8(np.clip(light/7,0,1)*255+.5))
 atlas.paste(img,((face%4)*256,(face//4)*256))
atlas.save(out,lossless=True)
