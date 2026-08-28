let debounceTimer;

function debounce(func, delay) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(func, delay);
}

function updateAllSliderHeights() {
  document.querySelectorAll(".main-slider.slider--adapt-to-image").forEach(slider => {
    const img = slider.querySelector(".swiper-slide:first-child img");
    if (!img) return;

    const setHeight = () => {
      const realHeight = img.naturalHeight / img.naturalWidth * slider.offsetWidth;
      slider.style.height = realHeight + "px";
    };

    if (img.complete) {
      setHeight();
    } else {
      img.addEventListener("load", setHeight, { once: true });
    }

    window.addEventListener("resize", setHeight);
  });
}

function initializeMainSlider() {
  debounce(() => {
    const mainSliderElements = document.querySelectorAll(".main-slider");

    mainSliderElements.forEach(function (sliderElement) {
      const enableImageAdaptation = sliderElement.dataset.adaptToImage === "true"; 

      if (sliderElement.swiper) {
        sliderElement.swiper.destroy(true, true);
      }

      const enableAutoplay = sliderElement.dataset.enableAutoplay === "true";
      const autoplaySpeedSeconds = parseFloat(sliderElement.dataset.autoplaySpeed) || 3;
      const autoplaySpeedMilliseconds = autoplaySpeedSeconds * 1000;
      const sliderDirection = sliderElement.dataset.sliderDirection;
      const sliderLoop = sliderElement.dataset.sliderLoop === "true";

      const mainSliderOptions = {
        loop: sliderLoop,
        speed: 1000,
        parallax: true,
        direction: sliderDirection,
        grabCursor: true,
        watchSlidesProgress: true,
        autoplay: enableAutoplay ? { delay: autoplaySpeedMilliseconds, disableOnInteraction: true } : false,
        navigation: {
          nextEl: ".swiper-button-next",
          prevEl: ".swiper-button-prev",
        },
        pagination: {
          el: ".swiper-pagination",
          type: "progressbar",
        },
        focusableElements: 'input, select, option, textarea, button, video, label',
        on: {
          init: function () {
            const swiper = this;
            const activeSlide = swiper.slides[swiper.activeIndex];
            const title = activeSlide.querySelector(".title");
            if (title) title.classList.add("show");

            const captionBox = activeSlide.querySelector(".caption-box");
            if (captionBox) captionBox.classList.add("show");

            const caption = activeSlide.querySelector(".caption");
            if (caption) caption.classList.add("show");

            const bannerButtons = activeSlide.querySelector(".banner-buttons");
            if (bannerButtons) bannerButtons.classList.add("show");

            if (swiper.autoplay && enableAutoplay) {
              swiper.autoplay.start();
            }

            if (enableImageAdaptation) {
              updateAllSliderHeights();
            }
          },
          slideChangeTransitionEnd: function () {
            const swiper = this;
            const captions = swiper.el.querySelectorAll(".caption, .banner-buttons, .title, .caption-box");
            captions.forEach(caption => caption.classList.remove("show"));

            const activeSlide = swiper.slides[swiper.activeIndex];
            const title = activeSlide.querySelector(".title");
            if (title) title.classList.add("show");

            const captionBox = activeSlide.querySelector(".caption-box");
            if (captionBox) captionBox.classList.add("show");

            const caption = activeSlide.querySelector(".caption");
            if (caption) caption.classList.add("show");

            const bannerButtons = activeSlide.querySelector(".banner-buttons");
            if (bannerButtons) bannerButtons.classList.add("show");
          },
          touchStart: function () {
            const swiper = this;
            swiper.slides.forEach(slide => {
              slide.style.transition = "";
            });
          },
        },
      };

      new Swiper(sliderElement, mainSliderOptions);
    });
  }, 300);
}

window.addEventListener("resize", () => {
  initializeMainSlider();
});

initializeMainSlider();
