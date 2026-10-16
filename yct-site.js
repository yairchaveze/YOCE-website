/* YoCellTherapy / YoCell Lab — menú móvil compartido de las subpáginas */
(function(){
  var b=document.getElementById('yctBurger'), l=document.getElementById('yctLinks');
  if(!b||!l)return;
  b.addEventListener('click',function(){var o=l.classList.toggle('open');b.setAttribute('aria-expanded',o)});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'){l.classList.remove('open');b.setAttribute('aria-expanded',false)}});
})();
