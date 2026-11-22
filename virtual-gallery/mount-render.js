import * as T from "./vendor/three.module.js";
import {mountSpec,scrollBands,handscrollBands,albumPanels,mirrorBands,frameProfiles} from "./mount-spec.js?v=desk33";

const woodMaps={"白橡木":"oak","胡桃木":"walnut","梣木":"ash","柚木":"teak"};
const weaveMaps={"織錦":"brocade","素絹":"plain-silk","花綾":"floral-twill","細麻":"linen"};
// Each tile spans a measured length and width. A mitred corner changes the grain direction.
const period={walnut:[1.22,.14],oak:[2.65,.255],ash:[2.45,.25],teak:[1.34,.185],
  brush:[.25,.06],linen:[.079,.079],cotton:[.073,.073],"plain-silk":[.064,.064],"floral-twill":[.13,.13],brocade:[.28,.284]};

function putMesh(group,name,geometry,material) {
  const mesh=new T.Mesh(geometry,material);
  mesh.name=name;
  mesh.castShadow=mesh.receiveShadow=true;
  group.add(mesh);
  return mesh;
}
function shapeBuffer() {
  const pos=[],uv=[],colors=[];
  return {
    quad(p,t,shade=1) {
      for(const i of [0,1,2,0,2,3]) {
        pos.push(...p[i]); uv.push(...t[i]); colors.push(shade,shade,shade);
      }
    },
    geometry() {
      const g=new T.BufferGeometry();
      g.setAttribute("position",new T.Float32BufferAttribute(pos,3));
      g.setAttribute("uv",new T.Float32BufferAttribute(uv,2));
      g.setAttribute("color",new T.Float32BufferAttribute(colors,3));
      g.computeVertexNormals(); return g;
    }
  };
}
function mitredRing(outerW,outerH,width,depth,baseZ,profile,tile,floating=false) {
  const shape=shapeBuffer();
  const signs=[[-1,-1],[1,-1],[1,1],[-1,1]];
  function vertex(corner,[inset,z]) {
    const [x,y]=signs[corner];
    return [x*(outerW/2-inset*width),y*(outerH/2-inset*width),baseZ+z*depth];
  }
  for(let side=0;side<4;side++) {
    const end=(side+1)%4, length=side%2 ? outerH : outerW;
    let across=(side*.27+.07)*tile[1];
    for(let i=1;i<profile.length;i++) {
      const a=profile[i-1],b=profile[i], next=across+Math.hypot((a[0]-b[0])*width,(a[1]-b[1])*depth);
      const along=side*.293;
      shape.quad([vertex(side,a),vertex(end,a),vertex(end,b),vertex(side,b)],[
        [along+a[0]*width/tile[0],across/tile[1]],[along+(length-a[0]*width)/tile[0],across/tile[1]],
        [along+(length-b[0]*width)/tile[0],next/tile[1]],[along+b[0]*width/tile[0],next/tile[1]]
      ],floating && i>=6 ? .21 : 1);
      across=next;
    }
  }
  return shape.geometry();
}
function panel(w,h,z,tile) {
  const g=new T.PlaneGeometry(w,h);
  const {position,uv}=g.attributes;
  for(let i=0;i<position.count;i++) uv.setXY(i,position.getX(i)/tile[0],position.getY(i)/tile[1]);
  g.translate(0,0,z);
  return g;
}

export function mountRenderer(renderer) {
  const textures=new Map(), loader=new T.TextureLoader(), anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);
  function map(kind,channel) {
    const key=kind+"-"+channel;
    if(!textures.has(key)) {
      const file=kind==="brocade" && channel!=="color" ? key+".webp" : "mount/"+key+".webp";
      const texture=loader.load(new URL("./materials/"+file,import.meta.url).href);
      if(channel==="color")texture.colorSpace=T.SRGBColorSpace;
      texture.wrapS=texture.wrapT=T.RepeatWrapping;
      texture.anisotropy=anisotropy; textures.set(key,texture);
    }
    return textures.get(key);
  }
  function surface(kind,strength) {
    if(!kind)return {};
    const props={map:map(kind,"color"),normalMap:map(kind,"normal"),normalScale:new T.Vector2(strength,strength)};
    if(kind==="brocade" || kind==="floral-twill" || Object.values(woodMaps).includes(kind))props.roughnessMap=map(kind,"rough");
    return props;
  }
  function cloth(kind,color,gloss=.15) {
    const twill=kind==="floral-twill";
    const sheen=twill ? .62 : kind==="linen" ? .12 : .45;
    return new T.MeshPhysicalMaterial({...surface(kind,kind==="brocade" ? .35 : .66),color,
      roughness:.93-gloss*.42,sheen,sheenRoughness:twill ? .47 : .58,
      sheenColor:new T.Color(color), envMapIntensity:.63,
      ...(twill ? {anisotropy:.32,anisotropyRotation:Math.PI/4} : {})});
  }
  function boxInterior(g,s) {
    const width=s.innerW,height=s.innerH,kind=s.matMaterial==="亞麻" ? "linen" : "cotton";
    const backing=new T.MeshStandardMaterial({...surface(kind,.45),color:s.matColor,roughness:.95});
    putMesh(g,"box-backboard",panel(width,height,s.boxFloorZ,period[kind]),backing);
    // Ring normals on the interior face point into the cavity; offset the joints by 0.2 mm.
    const lining=.0002, returnDepth=s.glassZ-s.boxFloorZ;
    putMesh(g,"box-liner",mitredRing(width+2*lining,height+2*lining,lining,returnDepth,s.boxFloorZ,
      [[0,1],[1,1],[1,0]],period[kind]),new T.MeshStandardMaterial({
        ...surface(kind,.42),color:s.linerColor,roughness:.94,vertexColors:true}));
    if(s.floatLift>0) {
      const inset=Math.min(.018,s.w*.07,s.h*.07);
      const block=putMesh(g,"box-spacer",new T.BoxGeometry(s.w-2*inset,s.h-2*inset,s.floatLift),
        new T.MeshStandardMaterial({color:s.matColor,roughness:.96}));
      block.position.z=s.boxFloorZ+s.floatLift/2;
    }
    const edge=putMesh(g,"artwork-support",new T.BoxGeometry(s.w,s.h,s.paperThickness),
      new T.MeshStandardMaterial({color:0xc8bca6,roughness:.91}));
    edge.position.z=s.faceZ-s.paperThickness/2-.00008;
    if(s.mat>0 && s.floatLift>0) {
      const spread=Math.min(s.mat/5,.0017+s.floatLift*.42);
      const shadow=softShadow(g,"box-paper-shadow",s.w,s.h,spread,.36,
        s.boxFloorZ+Math.min(.0003,s.floatLift/2),Math.min(spread,s.floatLift*.24));
      shadow.renderOrder=1;
    }
  }
  function glazing(g,s) {
    if(s.glazing==="無罩")return;
    const anti=s.glazing==="低反射玻璃";
    // A thin dielectric surface on the glazing rebate. Fresnel rises as the viewer walks past.
    const glass=new T.MeshPhysicalMaterial({color:0xe6e9e9,metalness:.43,roughness:anti ? .21 : .068,
      clearcoat:1,clearcoatRoughness:anti ? .16 : .04,envMapIntensity:anti ? .84 : 1.32,
      transparent:true,opacity:anti ? .021 : .054,depthWrite:false});
    glass.onBeforeCompile=shader=>{
      shader.fragmentShader=shader.fragmentShader.replace("#include <opaque_fragment>",`
        diffuseColor.a+=.16*pow(1.-max(0.,dot(normal,normalize(vViewPosition))),3.);
        #include <opaque_fragment>`);
    };
    const cover=putMesh(g,"frame-glazing",panel(s.innerW,s.innerH,s.glassZ,[1,1]),glass);
    cover.renderOrder=2; cover.castShadow=cover.receiveShadow=false;
    cover.raycast=()=>{};
  }
  function board(g,s) {
    const t=s.boardThickness, metal=s.boardMaterial==="鋁複合板", ply=s.boardMaterial==="木質板";
    if(s.wallStandoff>0) {
      const inset=Math.min(.065,s.w*.16,s.h*.16);
      const cleat=putMesh(g,"board-cleat",new T.BoxGeometry(s.w-2*inset,s.h-2*inset,s.wallStandoff),
        new T.MeshStandardMaterial({color:0x383b3a,metalness:.42,roughness:.74}));
      cleat.position.z=s.panelWallZ+s.wallStandoff/2;
    }
    const geo=new T.BoxGeometry(s.w,s.h,t);
    // The image itself closes the front face. Omitting the coincident solid face keeps thin panels clear at a distance.
    const front=geo.groups.find(group=>group.materialIndex===4);
    const indices=geo.index.array;
    geo.setIndex([...indices.slice(0,front.start),...indices.slice(front.start+front.count)]);
    geo.clearGroups();
    const edge=new T.MeshStandardMaterial({color:s.boardEdgeColor,roughness:metal ? .56 : ply ? .80 : .97,metalness:metal ? .19 : 0});
    if(metal || ply) {
      const uniforms={panelThickness:{value:t},panelSkin:{value:Math.min(.0003,t*.12)}};
      edge.onBeforeCompile=shader=>{
        Object.assign(shader.uniforms,uniforms);
        shader.vertexShader="varying float edgeZ;\n"+shader.vertexShader.replace("#include <begin_vertex>","#include <begin_vertex>\nedgeZ=position.z;");
        shader.fragmentShader="varying float edgeZ;uniform float panelThickness;uniform float panelSkin;\n"+shader.fragmentShader.replace("#include <color_fragment>",
          metal ? `#include <color_fragment>
            float d=panelThickness*.5-abs(edgeZ),aa=max(.00001,fwidth(edgeZ));
            float skin=1.-smoothstep(panelSkin-aa,panelSkin+aa,d);
            diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.54,.56,.57),skin*.82);` :
          `#include <color_fragment>
            float z=edgeZ/.0013,coverage=1.-smoothstep(.15,.65,fwidth(z));
            diffuseColor.rgb*=1.-coverage*(.08+.075*cos(6.283185*z));`);
      };
      edge.customProgramCacheKey=()=>metal ? "acm-cut" : "ply-cut";
    }
    const support=putMesh(g,"board-support",geo,edge);
    support.position.z=s.backZ+t/2;
    if(!s.isAcrylic)return;
    const gloss=s.surfaceSheen, rough=.35-.315*gloss;
    const acrylic={metalness:0,ior:1.49,roughness:rough,clearcoat:1,
      clearcoatRoughness:rough*.7,envMapIntensity:.8+1.4*gloss,transparent:true,depthWrite:false};
    const polish=new T.MeshPhysicalMaterial({...acrylic,color:0xd1e2e1,opacity:.55,side:T.DoubleSide});
    const bevel=Math.min(.0004,s.acrylicThickness*.085);
    const edges=putMesh(g,"acrylic-edges",mitredRing(s.w,s.h,bevel,s.acrylicThickness,s.faceZ,
      [[0,0],[0,1-bevel/s.acrylicThickness],[1,1]],[1,1]),polish);
    edges.renderOrder=1;
    const cover=new T.MeshPhysicalMaterial({...acrylic,color:0xdce6e5,opacity:.006+.023*gloss});
    // One reflection pass uses the same room probe as the frames. A directly viewed print stays clear.
    cover.onBeforeCompile=shader=>{
      shader.fragmentShader=shader.fragmentShader.replace("#include <opaque_fragment>",`
        diffuseColor.a+=.16*pow(1.-clamp(dot(normal,normalize(vViewPosition)),0.,1.),3.);
        #include <opaque_fragment>`);
    };
    const face=putMesh(g,"acrylic-face",panel(s.w,s.h,s.frontZ,[1,1]),cover);
    face.renderOrder=2;
    for(const clear of [edges,face]){clear.castShadow=clear.receiveShadow=false;clear.raycast=()=>{};}
  }
  function frame(g,s) {
    const {w,h,mat,frameWidth:f,faceZ,backZ,depth}=s;
    // A solid support is visible along the edges when the work is hung without a frame.
    if(s.isBox)boxInterior(g,s);
    else {
      const boardDepth=Math.max(.0004,faceZ-backZ-.0006);
      const board=putMesh(g,"artwork-support",new T.BoxGeometry(w,h,boardDepth),
        new T.MeshStandardMaterial({color:mat ? s.matColor : "#a49a82",roughness:.9}));
      board.position.z=faceZ-.0005-boardDepth/2;
    }
    if(s.isMirror) {
      const kind=weaveMaps[s.silkPattern],pitch=period[kind], silk=cloth(kind,s.silkColor);
      const z=s.isBox ? s.boxFloorZ+.00010 : faceZ-.0003;
      mirrorBands(s,(color,x,y,width,height,layer,part)=>{
        const geo=panel(width,height,z,pitch);
        const uv=geo.attributes.uv;
        // The two ends come from a separately cut strip across the grain.
        if(part==="ends")for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getY(i)+.22,-uv.getX(i));
        const piece=putMesh(g,"mirror-"+part,geo,silk);
        piece.position.set(x,y,0);
      });
      if(!s.isBox && !f) {
        const skin=Math.min(.004,depth);
        const base=putMesh(g,"mirror-support",new T.BoxGeometry(s.innerW,s.innerH,skin),
          new T.MeshStandardMaterial({color:s.silkColor,roughness:.86}));
        base.position.z=z-.00015-skin/2;
      }
    } else if(mat>0 && !s.isBox) {
      const kind=s.matMaterial==="亞麻" ? "linen" : "cotton";
      const material=new T.MeshStandardMaterial({...surface(kind,kind==="linen" ? .8 : .3),color:s.matColor,
        roughness:.96,vertexColors:true});
      const bevel=Math.min(.0033,mat*.46),cut=1-bevel/mat;
      const base=backZ+.0002, range=Math.max(.0004,faceZ-base+bevel);
      putMesh(g,"matboard",mitredRing(w+2*mat,h+2*mat,mat,range,base,
        [[0,0],[0,1],[cut,1],[1,Math.max(0,1-bevel/range)],[1,0]],period[kind]),material);
    }
    if(!f)return;
    glazing(g,s);
    const metal=s.frame==="金屬框",film=s.surfaceCover==="包膜",gloss=s.surfaceSheen;
    const wood=woodMaps[s.woodSpecies];
    const filmMaps={"素色":null,"髮絲紋":"brush","木紋":wood,"織紋":"linen"};
    const kind=film ? filmMaps[s.filmPattern] : (metal ? "brush" : wood);
    const metalRough={"鋁合金":.70,"黃銅":.63,"不鏽鋼":.53}[s.metalFinish];
    const roughTop=metal && !film ? metalRough : .89;
    const m=new T.MeshPhysicalMaterial({...surface(kind,film ? .24 : (metal ? .38 : .51)),
      color:s.frameColor,vertexColors:true,roughness:roughTop-(roughTop-.13)*gloss,
      metalness:film ? (kind==="brush" ? .58 : .02) : metal ? .88 : .025,
      clearcoat:film ? .54+.42*gloss : metal ? .06 : .15+.47*gloss,
      clearcoatRoughness:.64-.58*gloss,
      envMapIntensity:metal && !film ? 1.65 : 1.05});
    putMesh(g,"frame-rail",mitredRing(s.width,s.height,f,depth,backZ,
      frameProfiles[s.profile],period[kind]||[1,1],s.profile==="浮框"),m);
  }
  function scroll(g,s) {
    const sw=s.scrollWidth, h=s.h, z=s.faceZ-.0013, top=s.head, foot=s.foot;
    const kind=weaveMaps[s.silkPattern], tile=period[kind], silk=cloth(kind,s.silkColor);
    const ground=putMesh(g,"scroll-silk",panel(sw,s.scrollHeight,z,tile),silk);
    ground.position.y=(top+foot)/2;
    // Each brocade is sewn from flat cuts. Group patches of one dye into one draw call.
    const strips=new Map();
    function cut(color,x,y,w,h,layer=1) {
      if(w<=0 || h<=0)return;
      if(!strips.has(color))strips.set(color,shapeBuffer());
      const l=x-w/2,r=x+w/2,b=y-h/2,t=y+h/2,depth=z+layer*.00023;
      const corners=[[l,b],[r,b],[r,t],[l,t]];
      strips.get(color).quad(corners.map(([x,y])=>[x,y,depth]),corners.map(([x,y])=>[(x+.103)/tile[0],(y+.083)/tile[1]]));
    }
    scrollBands(s,cut);
    for(const [color,strip] of strips)putMesh(g,"scroll-bands",strip.geometry(),cloth(kind,color));
    const radius=s.rodDiameter/2;
    if(radius<=0)return;
    const copper=s.rodMaterial==="銅軸",lacquer=s.rodMaterial==="漆軸";
    const shaft=new T.MeshPhysicalMaterial({...surface(copper ? "brush" : lacquer ? null : woodMaps[s.woodSpecies],.29),
      color:s.rodColor,roughness:copper ? .36 : lacquer ? .19 : .48,metalness:copper ? .84 : .03,
      clearcoat:lacquer ? .93 : .28,clearcoatRoughness:lacquer ? .12 : .37,envMapIntensity:1.25});
    const batten=putMesh(g,"scroll-batten",new T.BoxGeometry(sw,s.battenHeight,Math.max(.002,s.battenHeight*.87)),shaft);
    batten.position.set(0,top,z+.001);
    const roller=putMesh(g,"scroll-roller",new T.CylinderGeometry(radius,radius,sw,32),silk);
    const uv=roller.geometry.attributes.uv;
    for(let i=0;i<uv.count;i++){
      const u=uv.getX(i),v=uv.getY(i);
      uv.setXY(i,v*sw/tile[0],u*2*Math.PI*radius/tile[1]);
    }
    roller.rotation.z=Math.PI/2;
    // The textile continues around the front of the roller.
    roller.position.set(0,foot,Math.max(s.backZ+radius,z-radius));
    const contour=[[0,.0],[.73,0],[.81,.035],[.82,.14],[.74,.18],[.70,.22],
      [.70,.36],[.82,.48],[.90,.69],[.90,.78],[.85,.83],[.85,.91],[.64,1],[0,1]];
    for(const side of [-1,1]) {
      const tip=putMesh(g,"scroll-finial-"+(side<0?"left":"right"),new T.LatheGeometry(
        contour.map(([r,x])=>new T.Vector2(radius*r,x*s.finialLength)),32),shaft);
      tip.rotation.z=-side*Math.PI/2;
      tip.position.set(side*sw/2,foot,roller.position.z);
    }
  }
  function album(g,s) {
    const coverStock=Math.min(.006,s.depth*.28), paperZ=s.faceZ-.0012, c=s.albumCover;
    const clothCover=cloth("linen",s.albumCoverColor), paper=new T.MeshStandardMaterial({
      ...surface("cotton",.29),color:s.albumLeafColor,roughness:.94,side:T.DoubleSide});
    const binding=putMesh(g,"album-cover",new T.BoxGeometry(c.w,c.h,coverStock),clothCover);
    binding.position.set(c.x,c.y,s.backZ+coverStock/2);
    const edges=paper.clone();
    paper.vertexColors=true;
    // Individual folded leaves leave fine, optically filtered horizontal lines in the exposed edge.
    edges.onBeforeCompile=shader=>{
      shader.vertexShader="varying float bookZ;varying float bookEdge;\n"+shader.vertexShader.replace("#include <begin_vertex>",
        "#include <begin_vertex>\nbookZ=position.z;bookEdge=1.-abs(normal.z);");
      shader.fragmentShader="varying float bookZ;varying float bookEdge;\n"+shader.fragmentShader.replace("#include <color_fragment>",
        `#include <color_fragment>
        float line=bookZ/.00078, visibility=1.-smoothstep(.18,.76,fwidth(line));
        diffuseColor.rgb*=1.-bookEdge*visibility*(.10+.085*cos(6.283185*line));`);
    };
    for(const p of s.albumLeaves) {
      const blockBase=s.backZ+coverStock,blockHeight=Math.max(.0005,paperZ-blockBase-.0011);
      const block=putMesh(g,"album-block",new T.BoxGeometry(p.w,p.h,blockHeight),edges);
      block.position.set(p.x,p.y,blockBase+blockHeight/2);
      const geom=new T.PlaneGeometry(p.w,p.h,28,24);
      const {position,uv}=geom.attributes,tones=[];
      for(let i=0;i<position.count;i++) {
        const x=position.getX(i), y=position.getY(i);
        let elevation=0;
        if(p.kind==="wing") {
          // The open concertina is viewed flat at the painting, with lifted concertina folds at both sides.
          const t=.5+p.side*x/p.w;
          elevation=Math.min(.050,p.w*.19)*t;
        } else if(p.kind==="facing") {
          const t=s.albumStyle==="蝴蝶裝" ? x/p.w+.5 : y/p.h+.5;
          elevation=-Math.min(.003,s.depth*.08)*(1-t)**4+.006*Math.sin(Math.PI*t);
        }
        const seamDistance=s.albumStyle==="經摺裝" ?
          (p.kind==="wing" ? p.w/2+p.side*x : p.w/2-Math.abs(x)) :
          s.albumStyle==="蝴蝶裝" ? p.w/2+(p.kind==="art" ? -x : x) : p.h/2+(p.kind==="art" ? -y : y);
        const tone=1-.23*Math.exp(-seamDistance/.021);
        tones.push(tone,tone,tone);
        position.setXYZ(i,p.x+x,p.y+y,paperZ+elevation);
        uv.setXY(i,(x+p.x+.03)/period.cotton[0],(y+p.y)/period.cotton[1]);
      }
      geom.setAttribute("color",new T.Float32BufferAttribute(tones,3));
      geom.computeVertexNormals();
      putMesh(g,p.kind==="wing" ? "album-fold" : "album-leaf",geom,paper);
    }
    albumPanels(s,(color,x,y,w,h,layer,name)=>{
      if(name!=="hinge")return;
      const horizontal=s.albumStyle==="推篷裝";
      const r=s.albumGap*.47;
      const joint=putMesh(g,"album-hinge",new T.CylinderGeometry(r,r,horizontal ? w : h,16),
        new T.MeshStandardMaterial({...surface("linen",.4),color:new T.Color(s.albumCoverColor).lerp(new T.Color(s.albumLeafColor),.42),roughness:.91}));
      if(horizontal)joint.rotation.z=Math.PI/2;
      joint.position.set(x,y,paperZ-r*1.3);
    });
  }
  function handscroll(g,s) {
    const kind=weaveMaps[s.silkPattern], tile=period[kind], z=s.faceZ-.002;
    const grand=s.handscrollStyle==="大鑲手卷";
    const paper=(color)=>new T.MeshStandardMaterial({...surface("cotton",.32),roughness:.96,color});
    const ground=putMesh(g,"handscroll-ground",panel(s.sheetRight-s.sheetLeft,s.handHeight,z,
      grand ? tile : period.cotton),grand ? cloth(kind,s.silkColor) : paper(s.matColor));
    ground.position.x=(s.sheetLeft+s.sheetRight)/2;
    const patches=new Map();
    handscrollBands(s,(color,x,y,w,h,layer,part,material)=>{
      if(!patches.has(part))patches.set(part,{shape:shapeBuffer(),color,material});
      const pitch=part==="head" ? [.19,.19] : material==="silk" ? tile : period.cotton;
      const l=x-w/2,r=x+w/2,b=y-h/2,t=y+h/2, corners=[[l,b],[r,b],[r,t],[l,t]];
      patches.get(part).shape.quad(corners.map(([x,y])=>[x,y,z+.00023*layer]),
        corners.map(([x,y])=>[(x+.073)/pitch[0],(y+.102)/pitch[1]]));
    });
    for(const [name,p] of patches) {
      const material=p.material==="silk" ? cloth(kind,p.color) : paper(p.color);
      if(name==="head")material.map=map("mottled-paper","color");
      putMesh(g,"handscroll-"+name,p.shape.geometry(),material);
    }
    const radius=s.coreRadius,H=s.handHeight,zAxis=z-radius+.0006;
    const copper=s.rodMaterial==="銅軸", lacquer=s.rodMaterial==="漆軸";
    const shaft=new T.MeshPhysicalMaterial({...surface(copper ? "brush" : lacquer ? null : woodMaps[s.woodSpecies],.29),
      color:s.rodColor,roughness:lacquer ? .18 : .43,metalness:copper ? .84 : .02,
      clearcoat:lacquer ? .92 : .27,clearcoatRoughness:.26});
    const core=putMesh(g,"handscroll-core",
      new T.CylinderGeometry(radius,radius,H+2*s.endProjection,32),shaft);
    core.position.set(s.sheetLeft-radius,0,zAxis);
    const wrap=putMesh(g,"handscroll-cover-end",
      new T.CylinderGeometry(radius*.72,radius*.72,H,32),cloth(kind,s.accentColor));
    const uvs=wrap.geometry.attributes.uv;
    for(let i=0;i<uvs.count;i++)uvs.setXY(i,uvs.getX(i)*2*Math.PI*radius*.72/tile[0],uvs.getY(i)*H/tile[1]);
    wrap.position.set(s.sheetRight,0,z-radius*.72+.0005);
  }
  function softShadow(g,name,w,h,spread,strength,z,offset=0) {
    const border=spread*3;
    const material=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{
      size:{value:new T.Vector2(w,h)},border:{value:border},spread:{value:spread},strength:{value:strength}},
      vertexShader:`varying vec2 p;void main(){p=uv-.5;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader:`varying vec2 p;uniform vec2 size;uniform float spread;uniform float border;uniform float strength;
        void main(){vec2 q=abs(p*(size+2.*border))-size*.5;float d=length(max(q,0.))+min(max(q.x,q.y),0.);
        float a=strength*(1.-smoothstep(-spread,spread*2.,d));gl_FragColor=vec4(.004,.003,.002,a);
        #include <colorspace_fragment>
        }`});
    const shadow=putMesh(g,name,new T.PlaneGeometry(w+border*2,h+border*2),material);
    shadow.castShadow=shadow.receiveShadow=false;
    shadow.position.set(offset,-offset*1.7,z);
    return shadow;
  }
  function contact(g,s,a) {
    const w=s.isScroll ? s.scrollWidth : s.width, h=s.isScroll ? s.scrollHeight : s.height;
    const depth=s.isScroll ? Math.min(s.depth,s.rodDiameter) : s.depth;
    const spread=s.isBoard ? .0015+s.wallStandoff*.42+depth*.15 : .016+Math.min(depth,.22)*.24;
    const wallZ=s.isBoard ? s.panelWallZ+.00018 : -.067;
    const shadow=softShadow(g,"mount-contact",w,h,spread,.33,wallZ-(a.z||0),spread*.21);
    shadow.userData.wallZ=wallZ;
    if(s.isHandscroll || s.isAlbum)shadow.position.x+=(s.left+s.right)/2;
    if(s.isAlbum)shadow.position.y+=(s.top+s.bottom)/2;
    if(s.isScroll)shadow.position.y+=(s.head+s.foot)/2;
    shadow.visible=Math.abs(a.z || 0)<.09;
  }
  function build(a) {
    const s=mountSpec(a), group=new T.Group();
    group.name="mount"; group.userData.spec=s;
    if(s.isBoard)board(group,s);
    else if(s.isAlbum)album(group,s);
    else if(s.isHandscroll)handscroll(group,s);
    else if(s.isScroll)scroll(group,s);
    else frame(group,s);
    contact(group,s,a);
    return group;
  }
  return {build,dispose(){for(const texture of textures.values())texture.dispose();textures.clear();}};
}

export function disposeMount(group) {
  const materials=new Set();
  group.traverse(o=>{o.geometry?.dispose(); if(o.material)materials.add(o.material);});
  for(const m of materials)m.dispose();
  group.removeFromParent();
}
