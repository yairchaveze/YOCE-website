/* YoCellTherapy / YoCell Lab — menú móvil compartido de las subpáginas */
(function(){
  var b=document.getElementById('yctBurger'), l=document.getElementById('yctLinks');
  if(!b||!l)return;
  b.addEventListener('click',function(){var o=l.classList.toggle('open');b.setAttribute('aria-expanded',o)});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'){l.classList.remove('open');b.setAttribute('aria-expanded',false)}});
})();
/* Logo animado del encabezado (yct-logo-anim.js) */
(function(){
  if(!document.querySelector('.yct-nav .yct-brand img[src*="yct-favicon"]'))return;
  var cur=document.currentScript||document.querySelector('script[src*="yct-site.js"]');
  var s=document.createElement('script');s.src=(cur&&cur.src?cur.src.replace(/yct-site\.js.*$/,''):'')+'yct-logo-anim.js';s.defer=true;document.head.appendChild(s);
})();
