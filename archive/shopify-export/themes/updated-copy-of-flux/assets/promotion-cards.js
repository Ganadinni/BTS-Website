// Hover Animation for Promotion Cards
function addHoverAnimation() {
  this.classList.add('hovered');
}
  
function removeHoverAnimation() {
  this.classList.remove('hovered');
}
  
var promotionCards = document.querySelectorAll('.promotion-cards');
  for (var i = 0; i < promotionCards.length; i++) {
    promotionCards[i].addEventListener('mouseenter', addHoverAnimation);
    promotionCards[i].addEventListener('mouseleave', removeHoverAnimation);
}