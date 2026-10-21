/* YoCellTherapy — logo animado del encabezado ("Activación")
   La Y nace del centro; al formarse, la membrana se vuelve un círculo perfecto,
   destello blanco, onda de señal y ráfaga radial de trazos (estilo La Célula Mexicana).
   Entre activaciones: membrana viva y antígeno (punto azul) recorriendo la membrana.
   Se repite cada 12 s. Respeta "reducir movimiento". El favicon de la pestaña queda estático. */
(function(){
  var NS='http://www.w3.org/2000/svg', MINT='#43C6A5', INK='#E7EFED', BLUE='#7F9CFF';
  var CYCLE=12, ACT=1.3, C=256, R=150, DOT0=Math.atan2(183.8-256,371.8-256);
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;

  function el(tag,attrs,parent){var e=document.createElementNS(NS,tag);for(var k in attrs)e.setAttribute(k,attrs[k]);if(parent)parent.appendChild(e);return e}

  function build(){
    var uid='yl'+Math.random().toString(36).slice(2,7);
    var svg=el('svg',{viewBox:'0 0 512 512','aria-hidden':'true',width:34,height:34});
    svg.style.cssText='width:34px;height:34px;display:block;flex:none';
    var defs=el('defs',{},svg);
    var rg=el('radialGradient',{id:uid+'g'},defs);
    el('stop',{offset:'0','stop-color':BLUE,'stop-opacity':'.6'},rg);el('stop',{offset:'1','stop-color':BLUE,'stop-opacity':'0'},rg);
    var fg=el('radialGradient',{id:uid+'f'},defs);
    el('stop',{offset:'0','stop-color':'#FFFFFF','stop-opacity':'1'},fg);el('stop',{offset:'.45','stop-color':'#F2F5F4','stop-opacity':'.85'},fg);el('stop',{offset:'1','stop-color':'#F2F5F4','stop-opacity':'0'},fg);
    el('rect',{width:512,height:512,rx:112,fill:'#0C1A1D'},svg);
    var g=el('g',{transform:'translate(256 256) scale(1.3) translate(-256 -256)'},svg);
    var o={svg:svg};
    o.ripple=el('circle',{cx:C,cy:C,r:0,fill:'none',stroke:MINT,'stroke-width':10,opacity:0},g);
    o.nuc=el('circle',{cx:C,cy:C,r:96,fill:MINT,'fill-opacity':.17},g);
    o.mem=el('path',{fill:'none',stroke:MINT,'stroke-width':24,'stroke-linejoin':'round'},g);
    o.y=el('path',{fill:'none',stroke:INK,'stroke-width':40,'stroke-linecap':'round','stroke-linejoin':'round'},g);
    o.halo=el('circle',{r:52,fill:'url(#'+uid+'g)'},g);
    o.dot=el('circle',{r:28,fill:BLUE},g);
    var sg=el('g',{'stroke-linecap':'round'},g);
    var seed=11,rnd=function(){seed=(seed*16807)%2147483647;return (seed-1)/2147483646};
    var cols=['#FFFFFF','#E7EFED',MINT,MINT,BLUE];
    o.sparks=[];
    for(var i=0;i<30;i++){var ling=rnd()<0.22;
      o.sparks.push({p:el('line',{stroke:cols[Math.floor(rnd()*cols.length)],'stroke-width':9,opacity:0},sg),
        a:rnd()*Math.PI*2,r0:158+rnd()*10,travel:(ling?25:40)+rnd()*45,len:18,delay:rnd()*0.12,dur:ling?2.2+rnd()*0.8:0.9+rnd()*0.6,ling:ling});}
    o.flash=el('circle',{cx:C,cy:C,r:250,fill:'url(#'+uid+'f)',opacity:0},g);
    return o;
  }

  function radius(th,t,amp){return R+amp*(0.5*Math.sin(3*th+t*0.9)+0.3*Math.sin(5*th-t*1.3)+0.2*Math.sin(2*th+t*0.6))}
  function easeOut(x){return 1-Math.pow(1-x,3)}
  function easeBack(x){var c=1.6;return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2)}
  function growth(c){
    if(c<0.35)return{w:easeOut(c/0.35),g:0};
    if(c<1.6)return{w:1,g:easeBack((c-0.35)/1.25)};
    if(c<CYCLE-0.8)return{w:1,g:1};
    var r=(c-(CYCLE-0.8))/0.8;return{w:1-easeOut(Math.max(0,(r-0.5)/0.5)),g:1-easeOut(Math.min(1,r/0.6))};
  }

  function draw(o,T){
    var yc=T%CYCLE, t=T*0.55;
    // Y que nace del centro
    var gr=growth(yc),jx=256,jy=260.5;
    function L(x,y){return (jx+(x-jx)*gr.g).toFixed(1)+' '+(jy+(y-jy)*gr.g).toFixed(1)}
    o.y.setAttribute('d','M'+L(202,199)+'L'+jx+' '+jy+'L'+L(310,199)+'M'+jx+' '+jy+'L'+L(256,323.5));
    o.y.setAttribute('stroke-width',(40*Math.max(0.001,gr.w)).toFixed(1));
    // membrana viva que se vuelve círculo perfecto en la activación
    var k=yc-ACT+0.25,snap=k<0?0:k<0.25?k/0.25:k<0.9?1:Math.max(0,1-(k-0.9)/1.4),amp=3*(1-snap),d='';
    for(var i=0;i<=72;i++){var th=i/72*Math.PI*2,r=radius(th,t,amp);d+=(i?'L':'M')+(C+r*Math.cos(th)).toFixed(1)+' '+(C+r*Math.sin(th)).toFixed(1)}
    o.mem.setAttribute('d',d+'Z');
    var pulse=Math.sin(t*1.2);
    o.nuc.setAttribute('r',(96+pulse*5).toFixed(1));o.nuc.setAttribute('fill-opacity',(0.17+pulse*0.04).toFixed(3));
    // antígeno recorriendo la membrana
    var a=DOT0-t*0.35,rd=radius(a,t,amp)-14,dx=(C+rd*Math.cos(a)).toFixed(1),dy=(C+rd*Math.sin(a)).toFixed(1);
    o.dot.setAttribute('cx',dx);o.dot.setAttribute('cy',dy);o.halo.setAttribute('cx',dx);o.halo.setAttribute('cy',dy);
    o.halo.setAttribute('r',(52+Math.sin(t*2.4)*8).toFixed(1));
    // onda de señal
    var ph=(yc-ACT)/1.6;
    if(ph>=0&&ph<1){o.ripple.setAttribute('r',(60+ph*190).toFixed(1));o.ripple.setAttribute('opacity',(0.55*(1-ph)).toFixed(3))}
    else o.ripple.setAttribute('opacity',0);
    // destello y ráfaga
    var k0=yc-ACT,f=0;
    if(k0>=0&&k0<0.06)f=k0/0.06;else if(k0>=0.06&&k0<0.5)f=1-(k0-0.06)/0.44;
    o.flash.setAttribute('opacity',(f*0.45).toFixed(3));
    o.sparks.forEach(function(s){
      var q=(k0-s.delay)/s.dur;
      if(q<0||q>1){s.p.setAttribute('opacity',0);return}
      var e=1-Math.pow(1-q,s.ling?2:4),rr=s.r0+s.travel*e,len=s.len*(1-q)*(s.ling?0.35:1)+(s.ling?2:0),c=Math.cos(s.a),sn=Math.sin(s.a);
      s.p.setAttribute('x1',(C+rr*c).toFixed(1));s.p.setAttribute('y1',(C+rr*sn).toFixed(1));
      s.p.setAttribute('x2',(C+(rr+len)*c).toFixed(1));s.p.setAttribute('y2',(C+(rr+len)*sn).toFixed(1));
      s.p.setAttribute('opacity',(Math.min(1,q*10)*(1-Math.pow(q,s.ling?1.5:2))).toFixed(3));
    });
  }

  function init(){
    var targets=[].slice.call(document.querySelectorAll('.yct-nav .yct-brand img[src*="yct-favicon"], header.nav .brand > svg'));
    if(!targets.length)return;
    var logos=targets.map(function(n){var o=build();n.parentNode.replaceChild(o.svg,n);return o});
    if(reduce){logos.forEach(function(o){draw(o,3)});return}
    var t0=null;
    function loop(ms){if(t0===null)t0=ms;var T=(ms-t0)/1000;logos.forEach(function(o){draw(o,T)});requestAnimationFrame(loop)}
    requestAnimationFrame(loop);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
