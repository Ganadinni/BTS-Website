if (!customElements.get('back-to-top')) {
	customElements.define('back-to-top', class ButtonScrollTop extends HTMLElement {
		constructor() {
			super();
			this.button = this.querySelector('.back-to-top');

			if (!this.button) {
				return;
			}

			this.timeout = null;
			window.addEventListener('scroll', () => {
				clearTimeout(this.timeout);

				this.timeout = setTimeout(() => {
					if (window.scrollY > 450) {
						this.button.classList.add('back-to-top-visible');
					} else {
						this.button.classList.remove('back-to-top-visible');
					}
				}, 200)
			});

			this.button.addEventListener('click', (event) => {
				event.preventDefault();
				this.handleClick();
			});
		}

		handleClick() {
			document.documentElement.scrollTo({
				top: 0,
				behavior: 'smooth',
			});
		}
	});
}