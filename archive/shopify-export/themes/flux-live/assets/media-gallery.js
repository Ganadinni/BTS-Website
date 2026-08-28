if (!customElements.get('media-gallery')) {
  customElements.define('media-gallery', class MediaGallery extends HTMLElement {
    constructor() {
      super();
      this.elements = {
        liveRegion: this.querySelector('[id^="GalleryStatus"]'),
        viewer: this.querySelector('[id^="GalleryViewer"]'),
        thumbnails: this.querySelector('[id^="GalleryThumbnails"]')
      }
      this.mql = window.matchMedia('(min-width: 750px)');
      if (!this.elements.thumbnails) return;

      this.elements.viewer.addEventListener('slideChanged', debounce(this.onSlideChanged.bind(this), 500));
      this.elements.thumbnails.querySelectorAll('[data-target]').forEach((mediaToSwitch) => {
        mediaToSwitch.querySelector('button').addEventListener('click', this.setActiveMedia.bind(this, mediaToSwitch.dataset.target, false));
      });
      if (this.dataset.desktopLayout.includes('thumbnail') && this.mql.matches) this.removeListSemantic();
    }

    onSlideChanged(event) {
      if (!event || !event.detail || !event.detail.currentElement) return; 
      const thumbnail = this.elements.thumbnails.querySelector(
        `[data-target="${event.detail.currentElement.dataset.mediaId}"]`
      );
      if (thumbnail) {
        this.setActiveThumbnail(thumbnail);
      }    
    }

    setActiveMedia(mediaId, prepend) {
      const activeMedia = this.elements.viewer.querySelector(`[data-media-id="${ mediaId }"]`);
      this.elements.viewer.querySelectorAll('[data-media-id]').forEach((element) => {
        element.classList.remove('is-active');
      });
      activeMedia.classList.add('is-active');

      if (prepend) {
        activeMedia.parentElement.prepend(activeMedia);
        if (this.elements.thumbnails) {
          const activeThumbnail = this.elements.thumbnails.querySelector(`[data-target="${ mediaId }"]`);
          activeThumbnail.parentElement.prepend(activeThumbnail);
        }
        if (this.elements.viewer.slider) this.elements.viewer.resetPages();
      }

      this.preventStickyHeader();
      window.setTimeout(() => {
        if (this.elements.thumbnails) {
          activeMedia.parentElement.scrollTo({ left: activeMedia.offsetLeft });
        }
        if (!this.elements.thumbnails || this.dataset.desktopLayout === 'stacked') {
          activeMedia.scrollIntoView({behavior: 'smooth'});
        }
      });
      this.playActiveMedia(activeMedia);

      if (!this.elements.thumbnails) return;
      const activeThumbnail = this.elements.thumbnails.querySelector(`[data-target="${ mediaId }"]`);
      this.setActiveThumbnail(activeThumbnail);
      this.announceLiveRegion(activeMedia, activeThumbnail.dataset.mediaPosition);
    }

    setActiveThumbnail(thumbnail) {
      if (!this.elements.thumbnails || !thumbnail) return;

      this.elements.thumbnails.querySelectorAll('button').forEach((element) => element.removeAttribute('aria-current'));
      thumbnail.querySelector('button').setAttribute('aria-current', true);
  
      this.elements.thumbnails.querySelectorAll('.thumbnail').forEach((element) => {
        element.classList.remove('is-active');
      });
  
      thumbnail.querySelector('.thumbnail').classList.add('is-active');

      if (this.elements.thumbnails.isSlideVisible(thumbnail, 10)) return;

      this.elements.thumbnails.slider.scrollTo({ left: thumbnail.offsetLeft });
    }

    announceLiveRegion(activeItem, position) {
      const image = activeItem.querySelector('.product__modal-opener--image img');
      if (!image) return;
      image.onload = () => {
        this.elements.liveRegion.setAttribute('aria-hidden', false);
        this.elements.liveRegion.innerHTML = window.accessibilityStrings.imageAvailable.replace(
          '[index]',
          position
        );
        setTimeout(() => {
          this.elements.liveRegion.setAttribute('aria-hidden', true);
        }, 2000);
      };
      image.src = image.src;
    }

    playActiveMedia(activeItem) {
      window.pauseAllMedia();
      const deferredMedia = activeItem.querySelector('.deferred-media');
      if (deferredMedia) deferredMedia.loadContent(false);
    }

    preventStickyHeader() {
      this.stickyHeader = this.stickyHeader || document.querySelector('sticky-header');
      if (!this.stickyHeader) return;
      this.stickyHeader.dispatchEvent(new Event('preventHeaderReveal'));
    }

    removeListSemantic() {
      if (!this.elements.viewer.slider) return;
      this.elements.viewer.slider.setAttribute('role', 'presentation');
      this.elements.viewer.sliderItems.forEach(slide => slide.setAttribute('role', 'presentation'));
    }
  });
}

class VerticalThumbnailSlider extends HTMLElement {
  constructor() {
    super();

    this.slider = this.querySelector("ul.slider");
    this.sliderItems = this.querySelectorAll("li.slider-slide");
    this.prevButton = this.querySelector('button[name="previous"]');
    this.nextButton = this.querySelector('button[name="next"]');
    this.step = parseInt(this.prevButton?.dataset.step || "1", 10);
    this.sliderItemHeight = 0;

    if (!this.slider || !this.nextButton) return;

    this.init();

    this.prevButton.addEventListener("click", this.scrollUp.bind(this));
    this.nextButton.addEventListener("click", this.scrollDown.bind(this));
    this.slider.addEventListener("scroll", this.updateButtons.bind(this));

    const resizeObserver = new ResizeObserver(() => this.init());
    resizeObserver.observe(this.slider);
  }

  init() {
    this.sliderItems = this.querySelectorAll("li.slider-slide");
    if (this.sliderItems.length < 2) return;

    this.sliderItemHeight =
      this.sliderItems[1].offsetTop - this.sliderItems[0].offsetTop;

    this.updateButtons();
  }

  scrollUp(e) {
    e.preventDefault();
    this.slider.scrollBy({
      top: -this.step * this.sliderItemHeight,
      behavior: "smooth"
    });
  }

  scrollDown(e) {
    e.preventDefault();
    this.slider.scrollBy({
      top: this.step * this.sliderItemHeight,
      behavior: "smooth"
    });
  }

  updateButtons() {
    if (!this.slider) return;

    const scrollTop = this.slider.scrollTop;
    const maxScrollTop = this.slider.scrollHeight - this.slider.clientHeight;

    if (scrollTop <= 0) {
      this.prevButton.style.display = "none";  
    } else {
      this.prevButton.style.display = "flex"; 
    }

    if (scrollTop >= maxScrollTop - 1) {
      this.nextButton.style.display = "none";  
    } else {
      this.nextButton.style.display = "flex";  
    }
  }

  isSlideVisible(element, offset = 0) {
    const lastVisibleSlide = this.slider.scrollTop + this.slider.clientHeight - offset;
    return (
      element.offsetTop + element.clientHeight <= lastVisibleSlide &&
      element.offsetTop >= this.slider.scrollTop
    );
  }
}

customElements.define("vertical-thumbnail-slider", VerticalThumbnailSlider);