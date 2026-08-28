function getFocusableElements(container) {
  return Array.from(
    container.querySelectorAll(
      "summary, a[href], button:enabled, [tabindex]:not([tabindex^='-']), [draggable], area, input:not([type=hidden]):enabled, select:enabled, textarea:enabled, object, iframe"
    )
  );
}

document.querySelectorAll('[id^="Details-"] summary').forEach((summary) => {
  summary.setAttribute("role", "button");
  summary.setAttribute(
    "aria-expanded",
    summary.parentNode.hasAttribute("open")
  );

  if (summary.nextElementSibling.getAttribute("id")) {
    summary.setAttribute("aria-controls", summary.nextElementSibling.id);
  }

  summary.addEventListener("click", (event) => {
    event.currentTarget.setAttribute(
      "aria-expanded",
      !event.currentTarget.closest("details").hasAttribute("open")
    );
  });

  if (summary.closest("header-drawer")) return;
  summary.parentElement.addEventListener("keyup", onKeyUpEscape);
});

const trapFocusHandlers = {};

function trapFocus(container, elementToFocus = container) {
  var elements = getFocusableElements(container);
  var first = elements[0];
  var last = elements[elements.length - 1];

  removeTrapFocus();

  trapFocusHandlers.focusin = (event) => {
    if (
      event.target !== container &&
      event.target !== last &&
      event.target !== first
    )
      return;

    document.addEventListener("keydown", trapFocusHandlers.keydown);
  };

  trapFocusHandlers.focusout = function () {
    document.removeEventListener("keydown", trapFocusHandlers.keydown);
  };

  trapFocusHandlers.keydown = function (event) {
    if (event.code.toUpperCase() !== "TAB") return; // If not TAB key
    // On the last focusable element and tab forward, focus the first element.
    if (event.target === last && !event.shiftKey) {
      event.preventDefault();
      first.focus();
    }

    //  On the first focusable element and tab backward, focus the last element.
    if (
      (event.target === container || event.target === first) &&
      event.shiftKey
    ) {
      event.preventDefault();
      last.focus();
    }
  };

  document.addEventListener("focusout", trapFocusHandlers.focusout);
  document.addEventListener("focusin", trapFocusHandlers.focusin);

  elementToFocus.focus();

  if (
    elementToFocus.tagName === "INPUT" &&
    ["search", "text", "email", "url"].includes(elementToFocus.type) &&
    elementToFocus.value
  ) {
    elementToFocus.setSelectionRange(0, elementToFocus.value.length);
  }
}

// Here run the querySelector to figure out if the browser supports :focus-visible or not and run code based on it.
try {
  document.querySelector(":focus-visible");
} catch (e) {
  focusVisiblePolyfill();
}

function focusVisiblePolyfill() {
  const navKeys = [
    "ARROWUP",
    "ARROWDOWN",
    "ARROWLEFT",
    "ARROWRIGHT",
    "TAB",
    "ENTER",
    "SPACE",
    "ESCAPE",
    "HOME",
    "END",
    "PAGEUP",
    "PAGEDOWN",
  ];
  let currentFocusedElement = null;
  let mouseClick = null;

  window.addEventListener("keydown", (event) => {
    if (navKeys.includes(event.code.toUpperCase())) {
      mouseClick = false;
    }
  });

  window.addEventListener("mousedown", (event) => {
    mouseClick = true;
  });

  window.addEventListener(
    "focus",
    () => {
      if (currentFocusedElement)
        currentFocusedElement.classList.remove("focused");

      if (mouseClick) return;

      currentFocusedElement = document.activeElement;
      currentFocusedElement.classList.add("focused");
    },
    true
  );
}

function pauseAllMedia() {
  document.querySelectorAll(".js-youtube").forEach((video) => {
    video.contentWindow.postMessage(
      '{"event":"command","func":"' + "pauseVideo" + '","args":""}',
      "*"
    );
  });
  document.querySelectorAll(".js-vimeo").forEach((video) => {
    video.contentWindow.postMessage('{"method":"pause"}', "*");
  });
  document.querySelectorAll("video").forEach((video) => video.pause());
  document.querySelectorAll("product-model").forEach((model) => {
    if (model.modelViewerUI) model.modelViewerUI.pause();
  });
}

function removeTrapFocus(elementToFocus = null) {
  document.removeEventListener("focusin", trapFocusHandlers.focusin);
  document.removeEventListener("focusout", trapFocusHandlers.focusout);
  document.removeEventListener("keydown", trapFocusHandlers.keydown);

  if (elementToFocus) elementToFocus.focus();
}

function onKeyUpEscape(event) {
  if (event.code.toUpperCase() !== "ESCAPE") return;

  const openDetailsElement = event.target.closest("details[open]");
  if (!openDetailsElement) return;

  const summaryElement = openDetailsElement.querySelector("summary");
  openDetailsElement.removeAttribute("open");
  summaryElement.setAttribute("aria-expanded", false);
  summaryElement.focus();
}

class QuantityInput extends HTMLElement {
  constructor() {
    super();
    this.input = this.querySelector("input");
    this.changeEvent = new Event("change", { bubbles: true });

    this.input.addEventListener("change", this.onInputChange.bind(this));
    this.querySelectorAll("button").forEach((button) =>
      button.addEventListener("click", this.onButtonClick.bind(this))
    );
  }

  quantityUpdateUnsubscriber = undefined;

  connectedCallback() {
    this.validateQtyRules();
    this.quantityUpdateUnsubscriber = subscribe(
      PUB_SUB_EVENTS.quantityUpdate,
      this.validateQtyRules.bind(this)
    );
  }

  disconnectedCallback() {
    if (this.quantityUpdateUnsubscriber) {
      this.quantityUpdateUnsubscriber();
    }
  }

  onInputChange(event) {
    this.validateQtyRules();
  }

  onButtonClick(event) {
    event.preventDefault();
    const previousValue = this.input.value;

    event.target.name === "plus" ? this.input.stepUp() : this.input.stepDown();
    if (previousValue !== this.input.value)
      this.input.dispatchEvent(this.changeEvent);
  }

  validateQtyRules() {
    const value = parseInt(this.input.value);
    if (this.input.min) {
      const min = parseInt(this.input.min);
      const buttonMinus = this.querySelector(".quantity-button[name='minus']");
      buttonMinus.classList.toggle("disabled", value <= min);
    }
    if (this.input.max) {
      const max = parseInt(this.input.max);
      const buttonPlus = this.querySelector(".quantity-button[name='plus']");
      buttonPlus.classList.toggle("disabled", value >= max);
    }
  }
}

customElements.define("quantity-input", QuantityInput);

function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

function fetchConfig(type = "json") {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: `application/${type}`,
    },
  };
}

/*
 * Shopify Common JS
 *
 */
if (typeof window.Shopify == "undefined") {
  window.Shopify = {};
}

Shopify.bind = function (fn, scope) {
  return function () {
    return fn.apply(scope, arguments);
  };
};

Shopify.setSelectorByValue = function (selector, value) {
  for (var i = 0, count = selector.options.length; i < count; i++) {
    var option = selector.options[i];
    if (value == option.value || value == option.innerHTML) {
      selector.selectedIndex = i;
      return i;
    }
  }
};

Shopify.addListener = function (target, eventName, callback) {
  target.addEventListener
    ? target.addEventListener(eventName, callback, false)
    : target.attachEvent("on" + eventName, callback);
};

Shopify.postLink = function (path, options) {
  options = options || {};
  var method = options["method"] || "post";
  var params = options["parameters"] || {};

  var form = document.createElement("form");
  form.setAttribute("method", method);
  form.setAttribute("action", path);

  for (var key in params) {
    var hiddenField = document.createElement("input");
    hiddenField.setAttribute("type", "hidden");
    hiddenField.setAttribute("name", key);
    hiddenField.setAttribute("value", params[key]);
    form.appendChild(hiddenField);
  }
  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
};

Shopify.CountryProvinceSelector = function (
  country_domid,
  province_domid,
  options
) {
  this.countryEl = document.getElementById(country_domid);
  this.provinceEl = document.getElementById(province_domid);
  this.provinceContainer = document.getElementById(
    options["hideElement"] || province_domid
  );

  Shopify.addListener(
    this.countryEl,
    "change",
    Shopify.bind(this.countryHandler, this)
  );

  this.initCountry();
  this.initProvince();
};

Shopify.CountryProvinceSelector.prototype = {
  initCountry: function () {
    var value = this.countryEl.getAttribute("data-default");
    Shopify.setSelectorByValue(this.countryEl, value);
    this.countryHandler();
  },

  initProvince: function () {
    var value = this.provinceEl.getAttribute("data-default");
    if (value && this.provinceEl.options.length > 0) {
      Shopify.setSelectorByValue(this.provinceEl, value);
    }
  },

  countryHandler: function (e) {
    var opt = this.countryEl.options[this.countryEl.selectedIndex];
    var raw = opt.getAttribute("data-provinces");
    var provinces = JSON.parse(raw);

    this.clearOptions(this.provinceEl);
    if (provinces && provinces.length == 0) {
      this.provinceContainer.style.display = "none";
    } else {
      for (var i = 0; i < provinces.length; i++) {
        var opt = document.createElement("option");
        opt.value = provinces[i][0];
        opt.innerHTML = provinces[i][1];
        this.provinceEl.appendChild(opt);
      }

      this.provinceContainer.style.display = "";
    }
  },

  clearOptions: function (selector) {
    while (selector.firstChild) {
      selector.removeChild(selector.firstChild);
    }
  },

  setOptions: function (selector, values) {
    for (var i = 0, count = values.length; i < values.length; i++) {
      var opt = document.createElement("option");
      opt.value = values[i];
      opt.innerHTML = values[i];
      selector.appendChild(opt);
    }
  },
};

/* Mobile Navigation */
class MenuDrawer extends HTMLElement {
  constructor() {
    super();

    this.mainDetailsToggle = this.querySelector("details");

    this.addEventListener("keyup", this.onKeyUp.bind(this));
    this.addEventListener("focusout", this.onFocusOut.bind(this));
    this.bindEvents();
  }

  bindEvents() {
    this.querySelectorAll("summary").forEach((summary) =>
      summary.addEventListener("click", this.onSummaryClick.bind(this))
    );
    this.querySelectorAll(".menu-drawer-close-button").forEach((button) =>
      button.addEventListener("click", this.onCloseButtonClick.bind(this))
    );
  }

  onKeyUp(event) {
    if (event.code.toUpperCase() !== "ESCAPE") return;

    const openDetailsElement = event.target.closest("details[open]");
    if (!openDetailsElement) return;

    openDetailsElement === this.mainDetailsToggle
      ? this.closeMenuDrawer(
          event,
          this.mainDetailsToggle.querySelector("summary")
        )
      : this.closeSubmenu(openDetailsElement);
  }

  onSummaryClick(event) {
    const summaryElement = event.currentTarget;
    const detailsElement = summaryElement.parentNode;
    const parentMenuElement = detailsElement.closest(".has-submenu");
    const isOpen = detailsElement.hasAttribute("open");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function addTrapFocus() {
      trapFocus(
        summaryElement.nextElementSibling,
        detailsElement.querySelector("button")
      );
      summaryElement.nextElementSibling.removeEventListener(
        "transitionend",
        addTrapFocus
      );
    }

    if (detailsElement === this.mainDetailsToggle) {
      if (isOpen) event.preventDefault();
      isOpen
        ? this.closeMenuDrawer(event, summaryElement)
        : this.openMenuDrawer(summaryElement);

      if (window.matchMedia("(max-width: 990px)")) {
        document.documentElement.style.setProperty(
          "--viewport-height",
          `${window.innerHeight}px`
        );
      }
    } else {
      setTimeout(() => {
        detailsElement.classList.add("menu-opening");
        summaryElement.setAttribute("aria-expanded", true);
        parentMenuElement && parentMenuElement.classList.add("submenu-open");
        !reducedMotion || reducedMotion.matches
          ? addTrapFocus()
          : summaryElement.nextElementSibling.addEventListener(
              "transitionend",
              addTrapFocus
            );
      }, 100);
    }
  }

  openMenuDrawer(summaryElement) {
    setTimeout(() => {
      this.mainDetailsToggle.classList.add("menu-opening");
    });
    summaryElement.setAttribute("aria-expanded", true);
    trapFocus(this.mainDetailsToggle, summaryElement);
    document.body.classList.add(`overflow-hidden-${this.dataset.breakpoint}`);

    if (window.matchMedia("(min-width: 768px)").matches) {
    document.body.style.overflow = "hidden";
    document.body.style.padding = "0 4px 0 0";
}

    const animatedElements = this.querySelectorAll("[data-aos]");
    animatedElements.forEach((element) => {
      element.classList.add("aos-animate");
    });
  }

  closeMenuDrawer(event, elementToFocus = false) {
    if (event === undefined) return;

    this.mainDetailsToggle.classList.remove("menu-opening");
    this.mainDetailsToggle.querySelectorAll("details").forEach((details) => {
      details.removeAttribute("open");
      details.classList.remove("menu-opening");
    });
    this.mainDetailsToggle
      .querySelectorAll(".submenu-open")
      .forEach((submenu) => {
        submenu.classList.remove("submenu-open");
      });
    document.body.classList.remove(
      `overflow-hidden-${this.dataset.breakpoint}`
    );
    removeTrapFocus(elementToFocus);
    this.closeAnimation(this.mainDetailsToggle);

if (window.matchMedia("(min-width: 768px)").matches) {
    setTimeout(() => {
        document.body.style.overflow = "scroll";
        document.body.style.padding = "0";
      document.body.style.overflowX = "hidden";
    }, 100); 
}

     const animatedElements = this.querySelectorAll(".aos-animate");
    animatedElements.forEach((element) => {
      element.classList.remove("aos-animate");
    });
  }

  onFocusOut(event) {
    setTimeout(() => {
      if (
        this.mainDetailsToggle.hasAttribute("open") &&
        !this.mainDetailsToggle.contains(document.activeElement)
      )
        this.closeMenuDrawer();
    });
  }

  onCloseButtonClick(event) {
    const detailsElement = event.currentTarget.closest("details");
    this.closeSubmenu(detailsElement);
  }

  closeSubmenu(detailsElement) {
    const parentMenuElement = detailsElement.closest(".submenu-open");
    parentMenuElement && parentMenuElement.classList.remove("submenu-open");
    detailsElement.classList.remove("menu-opening");
    detailsElement
      .querySelector("summary")
      .setAttribute("aria-expanded", false);
    removeTrapFocus(detailsElement.querySelector("summary"));
    this.closeAnimation(detailsElement);
  }

  closeAnimation(detailsElement) {
    let animationStart;

    const handleAnimation = (time) => {
      if (animationStart === undefined) {
        animationStart = time;
      }

      const elapsedTime = time - animationStart;

      if (elapsedTime < 400) {
        window.requestAnimationFrame(handleAnimation);
      } else {
        detailsElement.removeAttribute("open");
        if (detailsElement.closest("details[open]")) {
          trapFocus(
            detailsElement.closest("details[open]"),
            detailsElement.querySelector("summary")
          );
        }
      }
    };

    window.requestAnimationFrame(handleAnimation);
  }
}

customElements.define("menu-drawer", MenuDrawer);

class HeaderDrawer extends MenuDrawer {
  constructor() {
    super();
  }

  openMenuDrawer(summaryElement) {
    this.header = this.header || document.querySelector(".section-header");
    this.borderOffset =
      this.borderOffset ||
      this.closest(".header-wrapper").classList.contains(
        "header-wrapper--border-bottom"
      )
        ? 1
        : 0;
    document.documentElement.style.setProperty(
      "--header-bottom-position",
      `${parseInt(
        this.header.getBoundingClientRect().bottom - this.borderOffset
      )}px`
    );
    this.header.classList.add("menu-open");

    setTimeout(() => {
      this.mainDetailsToggle.classList.add("menu-opening");
    });

    summaryElement.setAttribute("aria-expanded", true);
    trapFocus(this.mainDetailsToggle, summaryElement);
    document.body.classList.add(`overflow-hidden-${this.dataset.breakpoint}`);
  }

  closeMenuDrawer(event, elementToFocus) {
    super.closeMenuDrawer(event, elementToFocus);
    this.header.classList.remove("menu-open");
  }
}

customElements.define("header-drawer", HeaderDrawer);

class ModalDialog extends HTMLElement {
  constructor() {
    super();
    this.querySelector('[id^="ModalClose-"]').addEventListener(
      "click",
      this.hide.bind(this, false)
    );
    this.addEventListener("keyup", (event) => {
      if (event.code.toUpperCase() === "ESCAPE") this.hide();
    });
    if (this.classList.contains("media-modal")) {
      this.addEventListener("pointerup", (event) => {
        if (
          event.pointerType === "mouse" &&
          !event.target.closest("deferred-media, product-model")
        )
          this.hide();
      });
    } else {
      this.addEventListener("click", (event) => {
        if (event.target === this) this.hide();
      });
    }
  }

  connectedCallback() {
    if (this.moved) return;
    this.moved = true;
    document.body.appendChild(this);
  }

  show(opener) {
    this.openedBy = opener;
    const popup = this.querySelector(".template-popup");
    document.body.classList.add("overflow-hidden");
    this.setAttribute("open", "");
    if (popup) popup.loadContent();
    trapFocus(this, this.querySelector('[role="dialog"]'));
    window.pauseAllMedia();
  }

  hide() {
    document.body.classList.remove("overflow-hidden");
    document.body.dispatchEvent(new CustomEvent("modalClosed"));
    this.removeAttribute("open");
    removeTrapFocus(this.openedBy);
    window.pauseAllMedia();
  }
}
customElements.define("modal-dialog", ModalDialog);

class ModalOpener extends HTMLElement {
  constructor() {
    super();

    const button = this.querySelector("button");

    if (!button) return;
    button.addEventListener("click", () => {
      const modal = document.querySelector(this.getAttribute("data-modal"));
      if (modal) modal.show(button);
    });
  }
}
customElements.define("modal-opener", ModalOpener);

class DeferredMedia extends HTMLElement {
  constructor() {
    super();
    const poster = this.querySelector('[id^="Deferred-Poster-"]');
    if (!poster) return;
    poster.addEventListener("click", this.loadContent.bind(this));
  }

  loadContent(focus = true) {
    window.pauseAllMedia();
    if (!this.getAttribute("loaded")) {
      const content = document.createElement("div");
      content.appendChild(
        this.querySelector("template").content.firstElementChild.cloneNode(true)
      );

      this.setAttribute("loaded", true);
      const deferredElement = this.appendChild(
        content.querySelector("video, model-viewer, iframe")
      );
      if (focus) deferredElement.focus();
    }
  }
}

customElements.define("deferred-media", DeferredMedia);

class SliderComponent extends HTMLElement {
  constructor() {
    super();

    this.slider = this.querySelector('[id^="Slider-"]');
    this.sliderItems = this.querySelectorAll('[id^="Slide-"]');
    this.enableSliderLooping = false;
    this.currentPageElement = this.querySelector(".slider-counter--current");
    this.pageTotalElement = this.querySelector(".slider-counter--total");
    this.prevButton = this.querySelector('button[name="previous"]');
    this.nextButton = this.querySelector('button[name="next"]');

    if (!this.slider || !this.nextButton) return;

    this.initPages();

    const resizeObserver = new ResizeObserver((entries) => this.initPages());
    resizeObserver.observe(this.slider);

    this.slider.addEventListener("scroll", this.update.bind(this));
    this.prevButton.addEventListener("click", this.onButtonClick.bind(this));
    this.nextButton.addEventListener("click", this.onButtonClick.bind(this));
  }

  initPages() {
    this.sliderItemsToShow = Array.from(this.sliderItems).filter(
      (element) => element.clientWidth > 0
    );

    if (this.sliderItemsToShow.length < 2) return;

    this.sliderItemOffset =
      this.sliderItemsToShow[1].offsetLeft -
      this.sliderItemsToShow[0].offsetLeft;
    this.slidesPerPage = Math.floor(
      (this.slider.clientWidth - this.sliderItemsToShow[0].offsetLeft) /
        this.sliderItemOffset
    );
    this.totalPages = this.sliderItemsToShow.length - this.slidesPerPage + 1;

    this.update();
  }

  resetPages() {
    this.sliderItems = this.querySelectorAll('[id^="Slide-"]');
    this.initPages();
  }

  update() {
    if (!this.slider || !this.nextButton) return;

    const previousPage = this.currentPage;
    this.currentPage =
      Math.round(this.slider.scrollLeft / this.sliderItemOffset) + 1;

    if (this.currentPageElement && this.pageTotalElement) {
      this.currentPageElement.textContent = this.currentPage;
      this.pageTotalElement.textContent = this.totalPages;
    }

    if (this.currentPage != previousPage) {
      this.dispatchEvent(
        new CustomEvent("slideChanged", {
          detail: {
            currentPage: this.currentPage,
            currentElement: this.sliderItemsToShow[this.currentPage - 1],
          },
        })
      );
    }

    if (this.enableSliderLooping) return;

    if (
      this.isSlideVisible(this.sliderItemsToShow[0]) &&
      this.slider.scrollLeft === 0
    ) {
      this.prevButton.setAttribute("disabled", "disabled");
    } else {
      this.prevButton.removeAttribute("disabled");
    }

    if (
      this.isSlideVisible(
        this.sliderItemsToShow[this.sliderItemsToShow.length - 1]
      )
    ) {
      this.nextButton.setAttribute("disabled", "disabled");
    } else {
      this.nextButton.removeAttribute("disabled");
    }
  }

  isSlideVisible(element, offset = 0) {
    const lastVisibleSlide =
      this.slider.clientWidth + this.slider.scrollLeft - offset;
    return (
      element.offsetLeft + element.clientWidth <= lastVisibleSlide &&
      element.offsetLeft >= this.slider.scrollLeft
    );
  }

  onButtonClick(event) {
    event.preventDefault();
    const step = event.currentTarget.dataset.step || 1;
    this.slideScrollPosition =
      event.currentTarget.name === "next"
        ? this.slider.scrollLeft + step * this.sliderItemOffset
        : this.slider.scrollLeft - step * this.sliderItemOffset;
    this.slider.scrollTo({
      left: this.slideScrollPosition,
    });
  }
}

customElements.define("slider-component", SliderComponent);

class SlideshowComponent extends SliderComponent {
  constructor() {
    super();
    this.sliderControlWrapper = this.querySelector(".slider-buttons");
    this.enableSliderLooping = true;

    if (!this.sliderControlWrapper) return;

    this.sliderFirstItemNode = this.slider.querySelector(".slideshow-slide");
    if (this.sliderItemsToShow.length > 0) this.currentPage = 1;

    this.sliderControlLinksArray = Array.from(
      this.sliderControlWrapper.querySelectorAll(".slider-counter-link")
    );
    this.sliderControlLinksArray.forEach((link) =>
      link.addEventListener("click", this.linkToSlide.bind(this))
    );
    this.slider.addEventListener("scroll", this.setSlideVisibility.bind(this));
    this.setSlideVisibility();

    if (this.slider.getAttribute("data-autoplay") === "true")
      this.setAutoPlay();
  }

  setAutoPlay() {
    this.sliderAutoplayButton = this.querySelector(".slideshow-autoplay");
    this.autoplaySpeed = this.slider.dataset.speed * 1000;

    this.sliderAutoplayButton.addEventListener(
      "click",
      this.autoPlayToggle.bind(this)
    );
    this.addEventListener("mouseover", this.focusInHandling.bind(this));
    this.addEventListener("mouseleave", this.focusOutHandling.bind(this));
    this.addEventListener("focusin", this.focusInHandling.bind(this));
    this.addEventListener("focusout", this.focusOutHandling.bind(this));

    this.play();
    this.autoplayButtonIsSetToPlay = true;
  }

  onButtonClick(event) {
    super.onButtonClick(event);
    const isFirstSlide = this.currentPage === 1;
    const isLastSlide = this.currentPage === this.sliderItemsToShow.length;

    if (!isFirstSlide && !isLastSlide) return;

    if (isFirstSlide && event.currentTarget.name === "previous") {
      this.slideScrollPosition =
        this.slider.scrollLeft +
        this.sliderFirstItemNode.clientWidth * this.sliderItemsToShow.length;
    } else if (isLastSlide && event.currentTarget.name === "next") {
      this.slideScrollPosition = 0;
    }
    this.slider.scrollTo({
      left: this.slideScrollPosition,
    });
  }

  update() {
    super.update();
    this.sliderControlButtons = this.querySelectorAll(".slider-counter-link");
    this.prevButton.removeAttribute("disabled");

    if (!this.sliderControlButtons.length) return;

    this.sliderControlButtons.forEach((link) => {
      link.classList.remove("slider-counter-link--active");
      link.removeAttribute("aria-current");
    });
    this.sliderControlButtons[this.currentPage - 1].classList.add(
      "slider-counter-link--active"
    );
    this.sliderControlButtons[this.currentPage - 1].setAttribute(
      "aria-current",
      true
    );
  }

  autoPlayToggle() {
    this.togglePlayButtonState(this.autoplayButtonIsSetToPlay);
    this.autoplayButtonIsSetToPlay ? this.pause() : this.play();
    this.autoplayButtonIsSetToPlay = !this.autoplayButtonIsSetToPlay;
  }

  focusOutHandling(event) {
    const focusedOnAutoplayButton =
      event.target === this.sliderAutoplayButton ||
      this.sliderAutoplayButton.contains(event.target);
    if (!this.autoplayButtonIsSetToPlay || focusedOnAutoplayButton) return;
    this.play();
  }

  focusInHandling(event) {
    const focusedOnAutoplayButton =
      event.target === this.sliderAutoplayButton ||
      this.sliderAutoplayButton.contains(event.target);
    if (focusedOnAutoplayButton && this.autoplayButtonIsSetToPlay) {
      this.play();
    } else if (this.autoplayButtonIsSetToPlay) {
      this.pause();
    }
  }

  play() {
    this.slider.setAttribute("aria-live", "off");
    clearInterval(this.autoplay);
    this.autoplay = setInterval(
      this.autoRotateSlides.bind(this),
      this.autoplaySpeed
    );
  }

  pause() {
    this.slider.setAttribute("aria-live", "polite");
    clearInterval(this.autoplay);
  }

  togglePlayButtonState(pauseAutoplay) {
    if (pauseAutoplay) {
      this.sliderAutoplayButton.classList.add("slideshow-autoplay--paused");
      this.sliderAutoplayButton.setAttribute(
        "aria-label",
        window.accessibilityStrings.playSlideshow
      );
    } else {
      this.sliderAutoplayButton.classList.remove("slideshow-autoplay--paused");
      this.sliderAutoplayButton.setAttribute(
        "aria-label",
        window.accessibilityStrings.pauseSlideshow
      );
    }
  }

  autoRotateSlides() {
    const slideScrollPosition =
      this.currentPage === this.sliderItems.length
        ? 0
        : this.slider.scrollLeft +
          this.slider.querySelector(".slideshow-slide").clientWidth;
    this.slider.scrollTo({
      left: slideScrollPosition,
      behavior: "smooth",
    });
  }

  setSlideVisibility() {
    this.sliderItemsToShow.forEach((item, index) => {
      const linkElements = item.querySelectorAll("a");
      if (index === this.currentPage - 1) {
        if (linkElements.length)
          linkElements.forEach((button) => {
            button.removeAttribute("tabindex");
          });
        item.setAttribute("aria-hidden", "false");
        item.removeAttribute("tabindex");
        item.classList.add("active");
      } else {
        if (linkElements.length)
          linkElements.forEach((button) => {
            button.setAttribute("tabindex", "-1");
          });
        item.setAttribute("aria-hidden", "true");
        item.setAttribute("tabindex", "-1");
        item.classList.remove("active");
      }
    });
  }

  linkToSlide(event) {
    event.preventDefault();
    const slideScrollPosition =
      this.slider.scrollLeft +
      this.sliderFirstItemNode.clientWidth *
        (this.sliderControlLinksArray.indexOf(event.currentTarget) +
          1 -
          this.currentPage);
    this.slider.scrollTo({
      left: slideScrollPosition,
      behavior: "smooth",
    });
  }
}

customElements.define("slideshow-component", SlideshowComponent);

class VariantSelects extends HTMLElement {
  constructor() {
    super();
    this.addEventListener("change", this.onVariantChange);
  }

  onVariantChange() {
    this.updateOptions();
    this.updateMasterId();
    this.toggleAddButton(true, "", false);
    this.updatePickupAvailability();
    this.updateSelectedSwatchValue(event);
    this.removeErrorMessage();
    this.updateVariantStatuses();

    if (!this.currentVariant) {
      this.toggleAddButton(true, "", true);
      this.setUnavailable();
    } else {
      this.updateMedia();
      this.updateURL();
      this.updateVariantInput();
      this.renderProductInfo();
      this.updateShareUrl();
    }
  }

  updateOptions() {
    this.options = Array.from(
      this.querySelectorAll("select"),
      (select) => select.value
    );
  }

  updateMasterId() {
    this.currentVariant = this.getVariantData().find((variant) => {
      return !variant.options
        .map((option, index) => {
          return this.options[index] === option;
        })
        .includes(false);
    });
  }

  updateSelectedSwatchValue({ target }) {
    const { name, value, tagName } = target;

    if (tagName === 'SELECT' && target.selectedOptions.length) {
      const swatchValue = target.selectedOptions[0].dataset.optionSwatchValue;
      const selectedDropdownSwatchValue = this.querySelector(`[data-selected-dropdown-swatch="${name}"] > .swatch`);
      if (!selectedDropdownSwatchValue) return;
      if (swatchValue) {
        selectedDropdownSwatchValue.style.setProperty('--swatch--background', swatchValue);
        selectedDropdownSwatchValue.classList.remove('swatch--unavailable');
      } else {
        selectedDropdownSwatchValue.style.setProperty('--swatch--background', 'unset');
        selectedDropdownSwatchValue.classList.add('swatch--unavailable');
      }
    } else if (tagName === 'INPUT' && target.type === 'radio') {
      const selectedSwatchValue = this.querySelector(`[data-selected-swatch-value="${name}"]`);
      if (selectedSwatchValue) selectedSwatchValue.innerHTML = value;
    }
  }

  updateMedia() {
    if (!this.currentVariant) return;
    if (!this.currentVariant.featured_media) return;

    const mediaGalleries = document.querySelectorAll(
      `[id^="MediaGallery-${this.dataset.section}"]`
    );
    mediaGalleries.forEach((mediaGallery) =>
      mediaGallery.setActiveMedia(
        `${this.dataset.section}-${this.currentVariant.featured_media.id}`,
        true
      )
    );

    const modalContent = document.querySelector(
      `#ProductModal-${this.dataset.section} .product-media-modal__content`
    );
    if (!modalContent) return;
    const newMediaModal = modalContent.querySelector(
      `[data-media-id="${this.currentVariant.featured_media.id}"]`
    );
    modalContent.prepend(newMediaModal);
  }

  updateURL() {
    if (!this.currentVariant || this.dataset.updateUrl === "false") return;
    window.history.replaceState(
      {},
      "",
      `${this.dataset.url}?variant=${this.currentVariant.id}`
    );
  }

  updateShareUrl() {
    const shareButton = document.getElementById(
      `Share-${this.dataset.section}`
    );
    if (!shareButton || !shareButton.updateUrl) return;
    shareButton.updateUrl(
      `${window.shopUrl}${this.dataset.url}?variant=${this.currentVariant.id}`
    );
  }

  updateVariantInput() {
    const productForms = document.querySelectorAll(
      `#product-form-${this.dataset.section}, #product-form-installment-${this.dataset.section}`
    );
    productForms.forEach((productForm) => {
      const input = productForm.querySelector('input[name="id"]');
      input.value = this.currentVariant.id;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  updateVariantStatuses() {
    const selectedOptionOneVariants = this.variantData.filter(
      (variant) => this.querySelector(":checked").value === variant.option1
    );
    const inputWrappers = [...this.querySelectorAll(".product-form-input")];
    inputWrappers.forEach((option, index) => {
      if (index === 0) return;
      const optionInputs = [
        ...option.querySelectorAll('input[type="radio"], option'),
      ];
      const previousOptionSelected =
        inputWrappers[index - 1].querySelector(":checked").value;
      const availableOptionInputsValue = selectedOptionOneVariants
        .filter(
          (variant) =>
            variant.available &&
            variant[`option${index}`] === previousOptionSelected
        )
        .map((variantOption) => variantOption[`option${index + 1}`]);
      this.setInputAvailability(optionInputs, availableOptionInputsValue);
    });
  }

  setInputAvailability(listOfOptions, listOfAvailableOptions) {
    const hideVariants = document.querySelector('[data-hide-variants="true"]') !== null;
    listOfOptions.forEach((input) => {
      if (listOfAvailableOptions.includes(input.getAttribute("value"))) {
        input.innerText = input.getAttribute("value");
        input.classList.remove("option-disabled");
        input.style.display = "";
      } else {
        if (hideVariants) {
        input.style.display = "none";
      } else {
        input.innerText = window.variantStrings.unavailable_with_option.replace(
          "[value]",
          input.getAttribute("value")
        );
        }
      }
    });
  }

  updatePickupAvailability() {
    const pickUpAvailability = document.querySelector("pickup-availability");
    if (!pickUpAvailability) return;

    if (this.currentVariant && this.currentVariant.available) {
      pickUpAvailability.fetchAvailability(this.currentVariant.id);
    } else {
      pickUpAvailability.removeAttribute("available");
      pickUpAvailability.innerHTML = "";
    }
  }

  removeErrorMessage() {
    const section = this.closest("section");
    if (!section) return;

    const productForm = section.querySelector("product-form");
    if (productForm) productForm.handleErrorMessage();
  }

  renderProductInfo() {
    const requestedVariantId = this.currentVariant.id;
    const sectionId = this.dataset.originalSection
      ? this.dataset.originalSection
      : this.dataset.section;

    fetch(
      `${this.dataset.url}?variant=${requestedVariantId}&section_id=${
        this.dataset.originalSection
          ? this.dataset.originalSection
          : this.dataset.section
      }`
    )
      .then((response) => response.text())
      .then((responseText) => {
        // prevent unnecessary ui changes from abandoned selections
        if (this.currentVariant.id !== requestedVariantId) return;

        const html = new DOMParser().parseFromString(responseText, "text/html");
        const destination = document.getElementById(
          `price-${this.dataset.section}`
        );
        const source = html.getElementById(
          `price-${
            this.dataset.originalSection
              ? this.dataset.originalSection
              : this.dataset.section
          }`
        );
        const skuSource = html.getElementById(
          `Sku-${
            this.dataset.originalSection
              ? this.dataset.originalSection
              : this.dataset.section
          }`
        );
        const skuDestination = document.getElementById(
          `Sku-${this.dataset.section}`
        );
        const inventorySource = html.getElementById(
          `Inventory-${
            this.dataset.originalSection
              ? this.dataset.originalSection
              : this.dataset.section
          }`
        );
        const inventoryDestination = document.getElementById(
          `Inventory-${this.dataset.section}`
        );

        if (source && destination) destination.innerHTML = source.innerHTML;
        if (inventorySource && inventoryDestination)
          inventoryDestination.innerHTML = inventorySource.innerHTML;
        if (skuSource && skuDestination) {
          skuDestination.innerHTML = skuSource.innerHTML;
          skuDestination.classList.toggle(
            "visibility-hidden",
            skuSource.classList.contains("visibility-hidden")
          );
        }

        const price = document.getElementById(`price-${this.dataset.section}`);

        if (price) price.classList.remove("visibility-hidden");

        if (inventoryDestination)
          inventoryDestination.classList.toggle(
            "visibility-hidden",
            inventorySource.innerText === ""
          );

        const addButtonUpdated = html.getElementById(
          `ProductSubmitButton-${sectionId}`
        );
        this.toggleAddButton(
          addButtonUpdated ? addButtonUpdated.hasAttribute("disabled") : true,
          window.variantStrings.soldOut
        );

        publish(PUB_SUB_EVENTS.variantChange, {
          data: {
            sectionId,
            html,
            variant: this.currentVariant,
          },
        });
      });
  }

  toggleAddButton(disable = true, text, modifyClass = true) {
    const productForm = document.getElementById(
      `product-form-${this.dataset.section}`
    );
    if (!productForm) return;
    const addButton = productForm.querySelector('[name="add"]');
    const addButtonText = productForm.querySelector('[name="add"] > span');
    if (!addButton) return;

    if (disable) {
      addButton.setAttribute("disabled", "disabled");
      if (text) addButtonText.textContent = text;
    } else {
      addButton.removeAttribute("disabled");
      addButtonText.textContent = window.variantStrings.addToCart;
    }

    if (!modifyClass) return;
  }

  setUnavailable() {
    const button = document.getElementById(
      `product-form-${this.dataset.section}`
    );
    const addButton = button.querySelector('[name="add"]');
    const addButtonText = button.querySelector('[name="add"] > span');
    const price = document.getElementById(`price-${this.dataset.section}`);
    const inventory = document.getElementById(
      `Inventory-${this.dataset.section}`
    );
    const sku = document.getElementById(`Sku-${this.dataset.section}`);

    if (!addButton) return;
    addButtonText.textContent = window.variantStrings.unavailable;
    if (price) price.classList.add("visibility-hidden");
    if (inventory) inventory.classList.add("visibility-hidden");
    if (sku) sku.classList.add("visibility-hidden");
  }

  getVariantData() {
    this.variantData =
      this.variantData ||
      JSON.parse(this.querySelector('[type="application/json"]').textContent);
    return this.variantData;
  }
}

customElements.define("variant-selects", VariantSelects);

class VariantRadios extends VariantSelects {
  constructor() {
    super();
  }

  setInputAvailability(listOfOptions, listOfAvailableOptions) {
    listOfOptions.forEach((input) => {
      if (listOfAvailableOptions.includes(input.getAttribute("value"))) {
        input.classList.remove("disabled");
      } else {
        input.classList.add("disabled");
      }
    });
  }

  updateOptions() {
    const fieldsets = Array.from(this.querySelectorAll("fieldset"));
    this.options = fieldsets.map((fieldset) => {
      return Array.from(fieldset.querySelectorAll("input")).find(
        (radio) => radio.checked
      ).value;
    });
  }
}

customElements.define("variant-radios", VariantRadios);

class ProductRecommendations extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    const handleIntersection = (entries, observer) => {
      if (!entries[0].isIntersecting) return;
      observer.unobserve(this);

      fetch(this.dataset.url)
        .then((response) => response.text())
        .then((text) => {
          const html = document.createElement("div");
          html.innerHTML = text;
          const recommendations = html.querySelector("product-recommendations");

          if (recommendations && recommendations.innerHTML.trim().length) {
            this.innerHTML = recommendations.innerHTML;
          }

          if (
            !this.querySelector("slideshow-component") &&
            this.classList.contains("complementary-products")
          ) {
            this.remove();
          }

          if (html.querySelector(".grid-item")) {
            this.classList.add("product-recommendations--loaded");
          }
        })
        .catch((e) => {
          console.error(e);
        });
    };

    new IntersectionObserver(handleIntersection.bind(this), {
      rootMargin: "0px 0px 400px 0px",
    }).observe(this);
  }
}

customElements.define("product-recommendations", ProductRecommendations);

class ComparisonSlider extends HTMLElement {
  constructor() {
    super();

    this.active = false;
    this.button = this.querySelector("button");
    this.horizontal = this.dataset.layout === "horizontal";
    this.bodyStyleOverflowY = document.body.style.overflowY;
    this.init();

    // Initialize Intersection Observer to trigger animation on scroll
    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.animateOnLoad(); // Trigger animation when in view
          this.observer.disconnect(); // Stop observing once animation starts
        }
      });
    });
    this.observer.observe(this);
  }

  init() {
    this.button.addEventListener("touchstart", this.startHandler.bind(this));
    document.body.addEventListener("touchend", this.endHandler.bind(this));
    document.body.addEventListener("touchmove", this.onHandler.bind(this));

    this.button.addEventListener("mousedown", this.startHandler.bind(this));
    document.body.addEventListener("mouseup", this.endHandler.bind(this));
    document.body.addEventListener("mousemove", this.onHandler.bind(this));
  }

  animateOnLoad() {
    let percent = 0;
    const targetPercent = 50; // Final position
    const speed = 1; // Adjust speed for slower animation

    const animate = () => {
      percent += speed; // Increment for smooth transition
      this.style.setProperty("--percent", percent + "%");

      if (percent < targetPercent) {
        requestAnimationFrame(animate); // Continue until target reached
      } else {
        this.style.setProperty("--percent", targetPercent + "%"); // Set exact target position
      }
    };
    requestAnimationFrame(animate);
  }

  startHandler() {
    if (window.innerWidth <= 750) {
      document.body.style.overflowY = "hidden";
    }

    this.active = true;
    this.classList.add("scrolling");
  }

  endHandler() {
    this.active = false;
    this.classList.remove("scrolling");
    document.body.style.overflowY = this.bodyStyleOverflowY;
  }

  onHandler(e) {
    if (!this.active) return;

    const event = (e.touches && e.touches[0]) || e;
    const x = this.horizontal
      ? event.pageX - this.offsetLeft
      : event.pageY - this.offsetTop;

    this.scrollIt(x);
  }

  scrollIt(x) {
    const distance = this.horizontal ? this.clientWidth : this.clientHeight;

    const max = distance - 20;
    const min = 20;
    const mouseX = Math.max(min, Math.min(x, max));
    const mousePercent = (mouseX * 100) / distance;
    this.style.setProperty("--percent", mousePercent + "%");
  }
}

customElements.define("comparison-slider", ComparisonSlider);

// Animate Details Element/
class CollapsibleRow extends HTMLElement {
  constructor() {
    super();

    this.details = this.querySelector("details");
    this.summary = this.querySelector("summary");
    this.content = this.querySelector(".collapsible__content");

    this.animation = null;
    this.isClosing = false;
    this.isExpanding = false;
  }

  connectedCallback() {
    this.setListeners();
  }

  setListeners() {
  if (!this.listenerAdded) {  
    this.querySelector("summary").addEventListener("click", (e) => this.onClick(e));
    this.listenerAdded = true;  
  }
}

 onClick(e) {
  e.preventDefault(); 
  e.stopPropagation(); 

  this.details.style.overflow = "hidden";

  if (this.isClosing || this.isExpanding) {
    return; 
  }

  if (!this.details.open) {
    this.open();
  } else {
    this.shrink();
  }
}

shrink() {

  this.isClosing = true;

  const startHeight = `${this.details.offsetHeight}px`;
  const endHeight = `${this.summary.offsetHeight}px`;

  if (this.animation) {
    this.animation.cancel();
  }

  this.animation = this.details.animate(
    {
      height: [startHeight, endHeight],
    },
    {
      duration: 300,
      easing: "ease",
    }
  );

  this.animation.onfinish = () => {
    this.onAnimationFinish(false);
  };
  this.animation.oncancel = () => {
    this.isClosing = false;
  };
}

  open() {
    this.details.style.height = `${this.details.offsetHeight}px`;
    this.details.open = true;
    window.requestAnimationFrame(() => this.expand());
  }

  expand() {

    this.isExpanding = true;

    const startHeight = `${this.details.offsetHeight}px`;
    const endHeight = `${this.details.offsetHeight + this.content.offsetHeight}px`;

    if (this.animation) {
      this.animation.cancel();
    }

    this.animation = this.details.animate(
      {
        height: [startHeight, endHeight],
      },
      {
        duration: 400,
        easing: "ease-out",
      }
    );

    this.animation.onfinish = () => this.onAnimationFinish(true);
    this.animation.oncancel = () => {
      this.isExpanding = false;
    };
  }

onAnimationFinish(open) {
  this.details.open = open;
  this.animation = null;
  this.isClosing = false;
  this.isExpanding = false;
  this.details.style.height = this.details.style.overflow = "";
}
}

customElements.define("collapsible-row", CollapsibleRow);

class CountdownTimer extends HTMLElement {
  connectedCallback() {
    // Retrieve attributes from the custom element
    const endDateString = this.getAttribute("end-date");
    const endDate = new Date(endDateString + " UTC");
    const utcEndDate = new Date(
      Date.UTC(
        endDate.getUTCFullYear(),
        endDate.getUTCMonth(),
        endDate.getUTCDate(),
        0,
        0,
        0
      )
    );
    const endTime = this.getAttribute("end-time");
    const countdownFinishedMessage = this.getAttribute(
      "countdown_finished_message"
    );

    // Calculate the countdown time
    const second = 1000;
    const minute = second * 60;
    const hour = minute * 60;
    const day = hour * 24;
    const countDownDateTimeUTC = new Date(
      Date.UTC(
        endDate.getUTCFullYear(),
        endDate.getUTCMonth(),
        endDate.getUTCDate(),
        parseInt(endTime.split(":")[0]),
        parseInt(endTime.split(":")[1]),
        0
      )
    ).getTime();

    // Update the countdown timer display
    const updateTimer = () => {
      const now = new Date().getTime();
      const distance = countDownDateTimeUTC - now;

      // Check if the countdown has reached zero
      if (distance <= 0) {
        clearInterval(interval); // Clear the interval to stop the countdown

        if (countdownFinishedMessage) {
          this.innerHTML = countdownFinishedMessage;
        } else {
          // Hide the section if no countdown finished message and the timer hits 0
          this.closest(".timer").style.display = "none";
        }
        return;
      }
      const days = Math.floor(distance / day);
      const hours = Math.floor((distance % day) / hour);
      const minutes = Math.floor((distance % hour) / minute);
      const seconds = Math.floor((distance % minute) / second);
      const show_days = window.translations.count_days;
      const show_hours = window.translations.count_hours;
      const show_minutes = window.translations.count_minutes;
      const show_seconds = window.translations.count_seconds;
      this.innerHTML = `
          <div class="js-timer-days"><span class="timer-number">${days}</span> <span class="timer-text">${show_days}</span></div>
          <div class="js-timer-hours"><span class="timer-number">${hours}</span> <span class="timer-text">${show_hours}</span></div>
          <div class="js-timer-minutes"><span class="timer-number">${minutes}</span> <span class="timer-text">${show_minutes}</span></div>
          <div class="js-timer-seconds"><span class="timer-number">${seconds}</span>  <span class="timer-text">${show_seconds}</span></div>
        `;

    };
    // Start the countdown timer
    const interval = setInterval(updateTimer, second);
  }
}
// Define the custom element
customElements.define("countdown-timer", CountdownTimer);

class LocationMap extends HTMLElement {
  constructor() {
    super();
    this.apiKey = this.getAttribute("api-key");
    this.address = this.getAttribute("address");
    this.zoomLevel = parseInt(this.getAttribute("zoom-level"));
    this.markerContent = this.getAttribute("marker-content");

    // Define marker and map as instance variables
    this.marker = null;
    this.map = null;

    // Keep track of whether the map has been created or not
    this.mapCreated = false;
  }

  connectedCallback() {
    // Check if the API key is available before loading the map
    if (this.apiKey) {
      this.loadGoogleMaps();
    }
  }

  loadGoogleMaps() {
    if (!window.googleMapsLoaded) {
      window.googleMapsLoaded = new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}`;
        script.onload = resolve;
        document.head.appendChild(script);
      });
    }

    window.googleMapsLoaded.then(() => this.initMap());
  }

  initMap() {
    if (!this.mapCreated) {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: this.address }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK) {
          const latitude = results[0].geometry.location.lat();
          const longitude = results[0].geometry.location.lng();

          // Initialize the Google Map
          const mapOptions = {
            center: { lat: latitude, lng: longitude },
            zoom: this.zoomLevel,
          };
          const mapElement = document.createElement("div");
          mapElement.style.height = "400px";
          this.appendChild(mapElement);
          this.map = new google.maps.Map(mapElement, mapOptions);

          // Add a marker to the map
          this.marker = new google.maps.Marker({
            position: { lat: latitude, lng: longitude },
            map: this.map,
            title: this.address,
          });

          // Add marker content infowindow
          const infowindow = new google.maps.InfoWindow({
            content: this.markerContent,
          });

          // Open infowindow on marker click
          this.marker.addListener("click", () => {
            this.fadeInInfoWindow(infowindow);
          });

          // Close infowindow when user clicks elsewhere on the map
          google.maps.event.addListener(this.map, "click", () => {
            infowindow.close();
          });

          // Set the mapCreated flag to true to prevent creating additional maps
          this.mapCreated = true;
        } else {
          console.error(
            "Geocode was not successful for the following reason: " + status
          );
        }
      });
    }
  }

  fadeInInfoWindow(infowindow) {
    // Set initial opacity of the infowindow container to 0
    infowindow.setOptions({ opacity: 0 });

    // Open the infowindow
    infowindow.open(this.map, this.marker);

    // Add a small delay to give time for the infowindow to render
    setTimeout(() => {
      // Use CSS transition to fade-in the infowindow container
      infowindow.setOptions({ opacity: 1 });
    }, 50); // Adjust the delay as needed
  }
}

customElements.define("location-map", LocationMap);

class CustomTabs extends HTMLElement {
  connectedCallback() {
    const tabItems = this.querySelectorAll(".tab-item a");
    const tabContents = this.querySelectorAll(".tab-content");

    // Show the first tab content by default
    tabContents[0].style.display = "block";
    tabItems[0].classList.add("active");

    // Handle tab click event
    tabItems.forEach((item, index) => {
      item.addEventListener("click", (e) => {
        e.preventDefault();

        // Hide all tab content
        tabContents.forEach((content) => {
          content.style.display = "none";
        });

        // Show the clicked tab content
        const target = item.getAttribute("href");
        this.querySelector(target).style.display = "block";

        // Remove active class from all tab items
        tabItems.forEach((tabItem) => {
          tabItem.classList.remove("active");
        });

        // Add active class to the clicked tab item
        item.classList.add("active");
      });
    });
  }
}
customElements.define("custom-tabs", CustomTabs);

class CustomTabsBlock extends HTMLElement {
  connectedCallback() {
    const tabItems = this.querySelectorAll(".tab-item a");
    const tabContents = this.querySelectorAll(".tab-content");

    if (tabItems.length === 0 || tabContents.length === 0) return;

    // Hide all tabs except the first one
    tabContents.forEach((content, index) => {
      content.style.display = index === 0 ? "block" : "none";
    });

    tabItems[0].classList.add("active");

    tabItems.forEach((item) => {
      item.addEventListener("click", (e) => {
        e.preventDefault();

        // Get the target tab ID
        const target = item.getAttribute("href");

        // Hide all tab contents
        tabContents.forEach((content) => {
          content.style.display = "none";
        });

        // Show the correct tab content
        const activeTab = this.querySelector(target);
        if (activeTab) {
          activeTab.style.display = "block";
        }

        // Remove active class from all tabs
        tabItems.forEach((tabItem) => {
          tabItem.classList.remove("active");
        });

        // Add active class to the clicked tab
        item.classList.add("active");
      });
    });
  }
}
customElements.define("custom-tabs-block", CustomTabsBlock);

// Text Scroll

class TextScroll extends HTMLElement {
  constructor() {
    super();
    this.inner_element = null;
    this.position = 0;
    this.speed = 0;
    this.box_width = 0;
    this.inner_element_width = 0;
    this.box = null;
    this._running = false;

    const getWidth = (element) => {
      if (!element) return 0; 
      const rect = element.getBoundingClientRect();
      return rect.right - rect.left;
    };

    const hasVisibleSpans = () => {
      const spans = this.querySelectorAll(".scroll-text-block > span");
      return spans.length > 0;
    };

    const setUpChildrens = () => {
      if (!this.inner_element || !this.box) return;
      const qty = Math.ceil(this.box_width / this.inner_element_width) + 1;
      while (this.box.children.length < qty) {
        this.box.appendChild(this.inner_element.cloneNode(true));
      }
      while (this.box.children.length > qty) {
        this.box.removeChild(this.box.lastChild);
      }
    };

    const refreshWidths = () => {
      if (!this.box || !this.inner_element) return;
      this.box_width = getWidth(this.box);
      this.inner_element_width = getWidth(this.inner_element);
    };

    const nextFrame = (delta, direction) => {
      if (!this.inner_element || !this.box || !hasVisibleSpans()) return; 
      refreshWidths();
      setUpChildrens();

      Array.from(this.box.children).forEach((el) => {
        const translateX = direction === "rtl" ? this.position : -this.position;
        el.style.transform = `translateX(${translateX}px)`;
      });

      this.position += (this.speed * delta) / 1000;
      if (this.position >= this.inner_element_width) {
        this.position %= this.inner_element_width;
      }
    };

    this.start = (direction) => {
      if (!this.inner_element || !this.box || !hasVisibleSpans()) return;
      this._running = true;
      let last_time = null;
      const loop_func = () => {
        if (!this._running || !hasVisibleSpans()) return;
        const now = Date.now();
        const delta = last_time === null ? 0 : now - last_time;
        nextFrame(delta, direction);
        last_time = now;
        window.requestAnimationFrame(loop_func);
      };
      window.requestAnimationFrame(loop_func);
    };

    this.stop = () => {
      this._running = false;
    };

    this.observeIntersection = (entries) => {
      if (entries[0].isIntersecting && hasVisibleSpans()) {
        this.start(this.dataset.scrollDirection);
      } else {
        this.stop();
      }
    };

    this.init = (direction) => {
      this.inner_element = this.children[0];
      this.box = this;

      if (!this.inner_element || !this.box || !hasVisibleSpans()) return;

      this.box_width = getWidth(this.box);
      this.inner_element_width = getWidth(this.inner_element);
      setUpChildrens();

      const intersectionObserver = new IntersectionObserver(this.observeIntersection);
      intersectionObserver.observe(this);

      if (this.dataset.stopOnHover === "true") {
        this.addEventListener("mouseenter", () => this.stop());
        this.addEventListener("mouseleave", () => this.start(direction));
      }
    };    

    const speed =
      window.innerWidth > 751
        ? parseInt(this.dataset.scrollSpeed)
        : parseInt(this.dataset.scrollSpeed) / 1.5;
    const direction = this.dataset.scrollDirection;
    this.speed = speed;

    this.init(direction);
  }
}

if (!customElements.get("text-scroll")) {
  customElements.define("text-scroll", TextScroll);
}

// Image Hotspots
class ImageHotspots extends HTMLElement {
  constructor() {
    super();
    this.sectionId = this.getAttribute("data-tooltips");
    this.attachEventListeners = this.attachEventListeners.bind(this);
    this.updateContent = this.updateContent.bind(this);
    this.loadFirstTooltip = this.loadFirstTooltip.bind(this);
  }

  connectedCallback() {
    this.initializeSection();
    this.reinitializeOnShopifyEvents();
  }

  updateContent(blockId, content) {
    const gridItemRight = this.querySelector(
      ".grid-item.right .dynamic-content-placeholder"
    );
    if (gridItemRight) {
      // Add a subtle fade-out animation before updating content
      gridItemRight.style.transition =
        "opacity 0.4s ease-out, transform 0.4s ease-out";
      gridItemRight.style.opacity = "0";
      gridItemRight.style.transform = "translateY(10px)"; // Slight slide-up effect

      // Wait for the fade-out transition to complete before updating content
      setTimeout(() => {
        // Update the content
        gridItemRight.innerHTML = content;

        // Trigger a fade-in animation after content is updated
        gridItemRight.style.opacity = "1";
        gridItemRight.style.transform = "translateY(0)";
      }, 400); // Match the duration of the fade-out animation
    }
  }

  loadFirstTooltip() {
    const firstTooltipButton = this.querySelector(
      ".tooltip-item:first-child .tooltip-button"
    );
    if (firstTooltipButton) {
      const blockId = firstTooltipButton.value;
      const tooltipContent = this.querySelector(
        `#tooltip-overlay-${blockId}`
      ).innerHTML;
      this.updateContent(blockId, tooltipContent);
    }
  }

  attachEventListeners() {
    this.querySelectorAll("[data-tooltip-trigger]").forEach((button) => {
      button.addEventListener("click", () => {
        const blockId = button.value;
        const tooltipContent = this.querySelector(
          `#tooltip-overlay-${blockId}`
        ).innerHTML;
        this.updateContent(blockId, tooltipContent);
      });
    });
  }

  initializeSection() {
    this.attachEventListeners();
    this.loadFirstTooltip();
  }

  reinitializeOnShopifyEvents() {
    if (window.Shopify && Shopify.designMode) {
      document.addEventListener("shopify:section:load", (event) => {
        if (event.detail.sectionId === this.sectionId) {
          this.initializeSection();
        }
      });

      document.addEventListener("shopify:section:select", (event) => {
        if (event.detail.sectionId === this.sectionId) {
          this.initializeSection();
        }
      });

      document.addEventListener("shopify:section:reorder", (event) => {
        if (event.detail.sectionId === this.sectionId) {
          this.initializeSection();
        }
      });
    }
  }
}

// Define the custom element
customElements.define("image-hotspots", ImageHotspots);

// Initialize all existing sections on page load
document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll("image-hotspots").forEach((section) => {
    section.initializeSection();
  });
});

// Tab Switcher

class TabSwitcher extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.querySelectorAll('input[type="radio"]').forEach((radio) => {
      radio.addEventListener('change', () => this.handleTabChange(radio));
    });

    document.addEventListener('shopify:section:select', () => {
      const radio = this.querySelector('input[type="radio"]:checked');
      this.handleTabChange(radio);
    });

    const checkedRadio = this.querySelector('input[type="radio"]:checked');
    if (checkedRadio) {
      this.handleTabChange(checkedRadio);  
    } else {
      const firstRadio = this.querySelector('input[type="radio"]');
      if (firstRadio) {
        firstRadio.checked = true;  
        this.handleTabChange(firstRadio);  
      }
    }

    window.addEventListener('resize', () => {
      const radio = this.querySelector('input[type="radio"]:checked');
      if (radio) {
        this.updateGliderPosition(radio);
      }
    });
  }

handleTabChange(radio) {
    const parts = radio.id.split('-');
    const sectionId = parts[1];

    if (parts.length < 3) {
        return; 
    }

    const collectionNumber = parseInt(parts[parts.length - 1], 10) - 1;

    this.querySelectorAll('.tab-content > div').forEach((content, index) => {
        if (index === collectionNumber) {
            content.style.display = 'block';
            content.setAttribute('data-aos', 'fade-up');
        } else {
            content.style.display = 'none';
            content.removeAttribute('data-aos');
            content.classList.remove('aos-animate');
        }
    });

    this.updateGliderPosition(radio);

    if (typeof AOS !== 'undefined') {
    AOS.init();
}

}

  updateGliderPosition(radio) {
    const glider = this.querySelector('.glider');
    const selectedLabel = radio.nextElementSibling; 

    const tabWidth = selectedLabel.offsetWidth;
    const tabLeft = selectedLabel.offsetLeft;

    glider.style.width = `${tabWidth}px`;
    glider.style.transform = `translateX(${tabLeft}px)`;
  }
}

customElements.define('tab-switcher', TabSwitcher);

// Slick Slider inspired with
/*!
 * Copyright (c) 2024 by Pedro Castro (https://codepen.io/aspeddro/pen/zqyJBr)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software 
 * and associated documentation files (the "Software"), to deal in the Software without restriction, 
 * including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, 
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies 
 * or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, 
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR 
 * PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE 
 * FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, 
 * ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *  * Modified by: Mana Themes
 * Changes:
 * - The JavaScript has been extensively rewritten to enhance functionality and adapt it for the theme's specific requirements.
 * - The Liquid files have been customized to align with the theme's design and layout needs.
 */

class SlickSlider extends HTMLElement {
  constructor() {
    super();
    this.current = 0;
    this.autoUpdate = false;
    this.timeTrans = 4000;
    this.slides = null;
  }

  connectedCallback() {
    this.initSlider();
  }

  initSlider() {
    const slickMain = this.closest(".slick-main");
    if (slickMain) {
      const enableAutoplay = slickMain.getAttribute("data-enable-autoplay");
      const autoplaySpeed = slickMain.getAttribute("data-autoplay-speed");
      this.autoUpdate = enableAutoplay === "true";
      this.timeTrans = autoplaySpeed ? parseInt(autoplaySpeed) * 1000 : 4000;
    }
    this.slides = this.querySelectorAll("li");

    if (this.autoUpdateInterval) {
      clearInterval(this.autoUpdateInterval);
    }

    const existingNav = this.querySelector(".nav_arrows");
    if (existingNav) {
      existingNav.remove();
    }


    if (this.slides.length > 1) {
      const nav = document.createElement("slick-nav");
      nav.className = "nav_arrows";

      const prevBtn = document.createElement("button");
      prevBtn.className = "prev";
      prevBtn.setAttribute("aria-label", "Prev");

      const nextBtn = document.createElement("button");
      nextBtn.className = "next";
      nextBtn.setAttribute("aria-label", "Next");

      const counter = document.createElement("div");
      counter.className = "slick-counter";
      counter.innerHTML = `<span>1</span><span>${this.slides.length}</span>`;

      nav.appendChild(prevBtn);
      nav.appendChild(counter);
      nav.appendChild(nextBtn);
      this.appendChild(nav);

      this.slides[this.current].classList.add("current");
      this.slides[this.slides.length - 1].classList.add("prev_slide");

      prevBtn.addEventListener("click", () => this.navigate("left"));
      nextBtn.addEventListener("click", () => this.navigate("right"));

      setInterval(() => {
        if (this.autoUpdate) this.navigate("right");
      }, this.timeTrans);

      this.addEventListener("mouseenter", () => (this.autoUpdate = false));
      this.addEventListener("mouseleave", () => (this.autoUpdate = true));

      document.addEventListener("keydown", (ev) => {
        if (ev.key === "ArrowLeft") this.navigate("left");
        if (ev.key === "ArrowRight") this.navigate("right");
      });

      this.addEventListener(
        "touchstart",
        (ev) => this.handleTouchStart(ev),
        false
      );
      this.addEventListener(
        "touchmove",
        (ev) => this.handleTouchMove(ev),
        false
      );
    }
  }

  navigate(direction) {
    this.slides.forEach((slide) => {
      slide.classList.remove("current", "prev_slide");
    });

    if (direction === "right") {
      this.current =
        this.current < this.slides.length - 1 ? this.current + 1 : 0;
    } else {
      this.current =
        this.current > 0 ? this.current - 1 : this.slides.length - 1;
    }

    const nextCurrent =
      this.current < this.slides.length - 1 ? this.current + 1 : 0;
    const prevCurrent =
      this.current > 0 ? this.current - 1 : this.slides.length - 1;

    this.slides[this.current].classList.add("current");
    this.slides[prevCurrent].classList.add("prev_slide");

    this.querySelector(".slick-counter span:first-child").textContent =
      this.current + 1;
  }
  handleTouchStart(evt) {
    this.xDown = evt.touches[0].clientX;
    this.yDown = evt.touches[0].clientY;
  }

  handleTouchMove(evt) {
    if (!this.xDown || !this.yDown) return;

    const xUp = evt.touches[0].clientX;
    const yUp = evt.touches[0].clientY;

    const xDiff = this.xDown - xUp;
    const yDiff = this.yDown - yUp;

    if (Math.abs(xDiff) > Math.abs(yDiff)) {
      if (xDiff > 0) this.navigate("right");
      else this.navigate("left");
    }

    this.xDown = null;
    this.yDown = null;
  }
  disconnectedCallback() {
  if (this.autoUpdateInterval) {
    clearInterval(this.autoUpdateInterval);
  }
 }
}

customElements.define("slick-slider", SlickSlider);

// Anchor link on sliders

function handleButtonClick(event) {
  var clickedElement = event.target;

  var sliderComponent = clickedElement.closest(
    "slider-component, slideshow-component"
  );

  if (sliderComponent) {
    if (clickedElement.matches(".button")) {
      var href = clickedElement.getAttribute("href");

      if (href && href.startsWith("#")) {
        event.preventDefault();

        var targetId = href.substring(1);
        var targetElement = document.getElementById(targetId);

        if (targetElement && targetElement.classList.contains("anchor")) {
          var slider = sliderComponent.querySelector(
            ".slider.slider--mobile, .slider--desktop, .slider--everywhere"
          );
          if (slider) {
            var scrollSnapType = slider.style.scrollSnapType;
            slider.style.scrollSnapType = "none";

            targetElement.scrollIntoView({ behavior: "smooth" });

            setTimeout(function () {
              slider.style.scrollSnapType = scrollSnapType;
            }, 500);
          } else {
            window.location.href = href;
          }
        } else {
          window.location.href = href;
        }
      }
    }
  }
}

document.addEventListener("click", handleButtonClick);

// Product Layout Switcher Desktop
function initializeLayoutSwitcher() {
  var productGrid = document.getElementById("product-grid");
  var desktopLayoutOptionsContainer = document.querySelector(".layout-options");
  var mobileLayoutOptionsContainer = document.querySelector(
    ".mobile-layout-options"
  );

  // Check if at least one layout options container exists
  if (!desktopLayoutOptionsContainer && !mobileLayoutOptionsContainer) {
    return; // Exit the function if neither container exists
  }

  var desktopLayoutOptions = document.querySelectorAll(".layout-options li");
  var mobileLayoutOptions = document.querySelectorAll(
    ".mobile-layout-options li"
  );

  // Get the default layout from local storage or data-columns attribute
  var lastDesktopLayout, lastMobileLayout;

  if (typeof Shopify === "undefined" || !Shopify.designMode) {
    // Normal mode (not in design mode)
    lastDesktopLayout =
      localStorage.getItem("lastDesktopLayout") ||
      productGrid?.getAttribute("data-columns-desktop");
    lastMobileLayout =
      localStorage.getItem("lastMobileLayout") ||
      productGrid?.getAttribute("data-columns-mobile");
  } else {
    // In Shopify design mode
    lastDesktopLayout = productGrid?.getAttribute("data-columns-desktop");
    lastMobileLayout = productGrid?.getAttribute("data-columns-mobile");
  }

  function updateLayout(selectedLayout, layoutType) {
    if (layoutType === "desktop") {
      productGrid.className = productGrid.className.replace(
        /grid--\d-col-desktop/g,
        ""
      );
      productGrid.classList.add("grid--" + selectedLayout + "-col-desktop");
      localStorage.setItem("lastDesktopLayout", selectedLayout);
    } else if (layoutType === "mobile") {
      productGrid.className = productGrid.className.replace(
        /grid--\d-col-tablet-down/g,
        ""
      );
      productGrid.classList.add("grid--" + selectedLayout + "-col-tablet-down");
      localStorage.setItem("lastMobileLayout", selectedLayout);
    }
  }

  function updateActiveClass(option, layoutType) {
    var options =
      layoutType === "desktop" ? desktopLayoutOptions : mobileLayoutOptions;
    options.forEach(function (opt) {
      opt.classList.remove("active");
    });
    option.classList.add("active");
  }

  function handleLayoutChange(event, layoutType) {
    var target = event.target.closest("li");
    if (target) {
      var selectedLayout = target.getAttribute("data-columns");
      updateLayout(selectedLayout, layoutType);
      updateActiveClass(target, layoutType);
    } 
  }

  // Attach event listeners using delegation to handle dynamically added options
  if (desktopLayoutOptionsContainer) {
    desktopLayoutOptionsContainer.addEventListener("click", function (event) {
      handleLayoutChange(event, "desktop");
    });
  }
  if (mobileLayoutOptionsContainer) {
    mobileLayoutOptionsContainer.addEventListener("click", function (event) {
      handleLayoutChange(event, "mobile");
    });
  }
  // Initialize the layout based on the local storage or the data-columns attribute from the Liquid file
  updateLayout(lastDesktopLayout, "desktop");
  updateLayout(lastMobileLayout, "mobile");

  // Set the active class on the selected layout option
  var defaultDesktopOption = document.querySelector(
    ".layout-options li[data-columns='" + lastDesktopLayout + "']"
  );
  if (defaultDesktopOption) defaultDesktopOption.classList.add("active");

  var defaultMobileOption = document.querySelector(
    ".mobile-layout-options li[data-columns='" + lastMobileLayout + "']"
  );
  if (defaultMobileOption) defaultMobileOption.classList.add("active");
}

// Wait for the window load event to ensure everything is loaded
window.addEventListener("load", function () {
  initializeLayoutSwitcher();

  // Observe the active facets for changes
  var activeFacetsElements = document.querySelectorAll(".active-facets");

  activeFacetsElements.forEach(function (element) {
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        initializeLayoutSwitcher();
      });
    });

    observer.observe(element, {
      childList: true,
      attributes: true,
      subtree: true,
    });
  });
  document.addEventListener('shopify:section:load', initializeLayoutSwitcher);
});

// Product page columns

class TwoColumnLayout extends HTMLElement {
  constructor() {
    super();
    // Binding methods to this instance
    this.arrangeBlocks = this.arrangeBlocks.bind(this);
    this.reorderBlocksForMobile = this.reorderBlocksForMobile.bind(this);
  }

  connectedCallback() {
    this.arrangeBlocks();
    window.addEventListener('resize', this.reorderBlocksForMobile);
    // Initial call to handle mobile layout right away
    this.reorderBlocksForMobile();
  }

  disconnectedCallback() {
    window.removeEventListener('resize', this.reorderBlocksForMobile);
  }

  arrangeBlocks() {
    const blocks = this.querySelectorAll('.block');
    const leftColumn = document.createElement('div');
    const rightColumn = document.createElement('div');
    const underGalleryContainer = document.getElementById('under-gallery');

    leftColumn.className = 'column-left';
    rightColumn.className = 'column-right';

    let leftCount = 0;
    let rightCount = 0;

    // Ensure the under-gallery is initially cleared
    underGalleryContainer.innerHTML = '';

    let lastColumn = 'left'; 

    blocks.forEach(block => {
      if (block.dataset.column === 'left') {
        leftColumn.appendChild(block);
        leftCount++;
        lastColumn = 'left';
      } else if (block.dataset.column === 'right') {
        rightColumn.appendChild(block);
        rightCount++;
        lastColumn = 'right';
      } else if (block.dataset.column === 'under-gallery') {
        underGalleryContainer.appendChild(block);
        lastColumn = 'under-gallery'; 
      } else {
        if (lastColumn === 'right') {
          rightColumn.appendChild(block);
          rightCount++;
        } else {
          leftColumn.appendChild(block);
          leftCount++;
          lastColumn = 'left'; 
        }
      }
    });

    // Clear existing content before appending columns
    this.innerHTML = '';
    this.appendChild(leftColumn);
    this.appendChild(rightColumn);

    // Adjust the widths based on content
    if (leftCount === 0 || rightCount === 0) {
      leftColumn.style.width = '100%';
      rightColumn.style.width = '100%';
    } else {
      leftColumn.style.width = '48%';
      rightColumn.style.width = '48%';
    }

    // Display or hide under-gallery based on content
    underGalleryContainer.style.display = underGalleryContainer.children.length > 0 ? 'block' : 'none';
  }

  reorderBlocksForMobile() {
    const underGallery = document.getElementById('under-gallery');
    const productGallery = document.getElementById('product-gallery');
    const position = this.getAttribute('data-position');

    if (window.innerWidth <= 990) {
      if (position === 'first' && productGallery) {
        productGallery.appendChild(underGallery);
      } else {
        this.appendChild(underGallery);
      }
    } else if (productGallery) {
      productGallery.appendChild(underGallery);
    }
  }
}

customElements.define('two-column-layout', TwoColumnLayout);

// Word Animator

class TextSlider extends HTMLElement {
  constructor() {
    super();
    this.currentIndex = 0;
    this.textElements = Array.from(this.querySelectorAll("div")); 
    this.changeText = this.changeText.bind(this);

    if (this.textElements.length > 0) {
      this.textElements[this.currentIndex].classList.add("active");
    }
  }

  connectedCallback() {
    if (this.textElements.length > 0) {
      this.interval = setInterval(this.changeText, 6000);
    }
  }

  disconnectedCallback() {
    clearInterval(this.interval); 
  }

  changeText() {
    if (this.textElements.length > 0) {
      this.textElements[this.currentIndex].classList.remove("active");

      this.currentIndex = (this.currentIndex + 1) % this.textElements.length;

      this.textElements[this.currentIndex].classList.add("active");
    }
  }
}

customElements.define('text-slider', TextSlider);

// Infocards

class InfocardElement extends HTMLElement {
  constructor() {
      super();
      this.expandedinfocard = null;
      this.initialProperties = [];
      this.finalProperties = [];
      this.infocardClip = null;

      this.expand = this.expand.bind(this);
      this.collapse = this.collapse.bind(this);
      this.onExpandTransitionEnd = this.onExpandTransitionEnd.bind(this);
      this.onCollapseTransitionEnd = this.onCollapseTransitionEnd.bind(this);
  }

  connectedCallback() {
      // Handle click to expand
      this.addEventListener("click", (e) => {
          if (this.expandedinfocard) return;
          this.expandedinfocard = this;

          const closeButton = this.querySelector(".js-close-button");
          if (closeButton) {
              closeButton.removeEventListener("click", this.collapse);
              closeButton.addEventListener("click", this.collapse);
          }

          this.expand();
      });

      // Handle keydown to expand
      this.addEventListener("keydown", (e) => {
          if (this.expandedinfocard) return;

          if (e.key === "Enter" || e.key === " ") {
              e.preventDefault(); // Prevent scrolling on Space
              this.expandedinfocard = this;

              const closeButton = this.querySelector(".js-close-button");
              if (closeButton) {
                  closeButton.removeEventListener("click", this.collapse);
                  closeButton.addEventListener("click", this.collapse);
              }

              this.expand();
          }
      });

      // Add ARIA attributes
      this.setAttribute("role", "button");
      this.setAttribute("tabindex", "0");
      this.setAttribute("aria-expanded", "false");
  }

  disconnectedCallback() {
      const closeButton = this.querySelector(".js-close-button");
      if (closeButton) closeButton.removeEventListener("click", this.collapse);
  }

  expand() {
      this.setAttribute("aria-expanded", "true");
      this.removeAttribute("data-aos");

      const infocardContent = this.getInfocardContent();
      infocardContent.removeEventListener("transitionend", this.onCollapseTransitionEnd);
      infocardContent.addEventListener("transitionend", this.onExpandTransitionEnd);

      this.disablePageScroll();
      this.collectInitialProperties();

      this.classList.add("infocard--expanded");

      this.collectFinalProperties();
      this.setInvertedTransformAndOpacity();
      this.clipInfocardContent();

      requestAnimationFrame(() => {
          this.classList.add("infocard--animatable");
          this.startExpanding();
      });
  }

  collapse(event) {
      if (event) event.stopPropagation();
      this.setAttribute("aria-expanded", "false");

      const infocardContent = this.getInfocardContent();
      infocardContent.removeEventListener("transitionend", this.onExpandTransitionEnd);
      infocardContent.addEventListener("transitionend", this.onCollapseTransitionEnd);

      this.setCollapsingInitialStyles();

      requestAnimationFrame(() => {
          this.classList.add("infocard--animatable");
          this.startCollapsing();
      });
  }

  onExpandTransitionEnd(e) {
      if (e.target !== this.getInfocardContent()) return;
      this.classList.remove("infocard--animatable");
      this.getInfocardContent().removeEventListener("transitionend", this.onExpandTransitionEnd);
      this.removeStyles();

      // Focus the close button for better accessibility
      const closeButton = this.querySelector(".js-close-button");
      if (closeButton) closeButton.focus();
  }

  onCollapseTransitionEnd(e) {
      if (e.target !== this.getInfocardContent()) return;
      this.classList.remove("infocard--animatable");
      this.classList.remove("infocard--expanded");

      this.getInfocardContent().removeEventListener("transitionend", this.onCollapseTransitionEnd);
      this.removeStyles();
      this.enablePageScroll();
      this.cleanup();
  }

  getAnimatableElements() {
      return this.querySelectorAll(".js-animatable");
  }

  getInfocardContent() {
      return this.querySelector(".infocard__content");
  }

  disablePageScroll() {
      document.body.style.overflow = "hidden";
      document.body.style.padding = "0 4px 0 0";
  }

  enablePageScroll() {
      document.body.style.overflow = "";
      document.body.style.padding = "0";
  }

  removeStyles() {
      for (const element of this.getAnimatableElements()) {
          element.style = null;
      }
      this.getInfocardContent().style = null;
  }

  collectInitialProperties() {
      this.initialProperties = [];
      for (const element of this.getAnimatableElements()) {
          this.initialProperties.push({
              rect: element.getBoundingClientRect(),
              opacity: parseFloat(window.getComputedStyle(element).opacity),
          });
      }

      const infocardRect = this.getBoundingClientRect();
      this.infocardClip = {
          top: infocardRect.top,
          right: window.innerWidth - infocardRect.right,
          bottom: window.innerHeight - infocardRect.bottom,
          left: infocardRect.left,
      };
  }

  collectFinalProperties() {
      this.finalProperties = [];
      for (const element of this.getAnimatableElements()) {
          this.finalProperties.push({
              rect: element.getBoundingClientRect(),
              opacity: parseFloat(window.getComputedStyle(element).opacity),
          });
      }
  }

  setInvertedTransformAndOpacity() {
      const elements = this.getAnimatableElements();
      elements.forEach((element, i) => {
          element.style.transform = `translate(${
              this.initialProperties[i].rect.left - this.finalProperties[i].rect.left
          }px, ${
              this.initialProperties[i].rect.top - this.finalProperties[i].rect.top
          }px) scale(${
              this.initialProperties[i].rect.width / this.finalProperties[i].rect.width
          })`;

          element.style.opacity = `${this.initialProperties[i].opacity}`;
      });
  }

  clipInfocardContent() {
      this.getInfocardContent().style.clipPath = `inset(${this.infocardClip.top}px ${this.infocardClip.right}px ${this.infocardClip.bottom}px ${this.infocardClip.left}px round 5px)`;
  }

  startExpanding() {
      const elements = this.getAnimatableElements();
      elements.forEach((element, i) => {
          element.style.transform = "translate(0, 0) scale(1)";
          element.style.opacity = `${this.finalProperties[i].opacity}`;
      });

      this.getInfocardContent().style.clipPath = "inset(0)";
  }

  setCollapsingInitialStyles() {
      for (const element of this.getAnimatableElements()) {
          element.style.transform = "translate(0, 0) scale(1)";
      }
      this.getInfocardContent().style.clipPath = "inset(0)";
  }

  startCollapsing() {
      this.setInvertedTransformAndOpacity();
      this.clipInfocardContent();
  }

  cleanup() {
      this.expandedinfocard = null;
      this.infocardClip = null;
      this.initialProperties = [];
      this.finalProperties = [];
  }
}

customElements.define("infocard-element", InfocardElement);


// Add additional div for the cart page (cart-items and cart-footer)

document.addEventListener("DOMContentLoaded", function () {
  updateCartLayout()
});
function updateCartLayout() {
  const cartItems = document.querySelector(".cart__items-wrapper");
  const cartFooter = document.querySelector(".cart__footer-wrapper");

  if (cartItems && cartFooter) {
      const isEmpty = document.querySelector(".cart__items-wrapper .is-empty");
  
      if (isEmpty) {
          cartItems.classList.add("empty-cart");
      }   
  
      // Check if a parent with the class "page-width" already exists
      let wrapper = cartItems.closest(".page-width");
  
      if (!wrapper) {
          // If not found, create and insert the wrapper
          wrapper = document.createElement("div");
          wrapper.classList.add("page-width");
  
          const parent = cartItems.parentNode;
          parent.insertBefore(wrapper, cartItems);
  
          wrapper.appendChild(cartItems);
          wrapper.appendChild(cartFooter);
      }
  }
}

// Nutritional info

class IngredientDetails extends HTMLElement {
  constructor() {
      super();
  }
  connectedCallback() {
      let content = this.innerHTML;

      content = content.replace(/<\/?p>/g, '');
      content = content.replace(/<br\s*\/?>/g, '|||BR|||');

      let rows = content.split("|||BR|||").map(row => row.trim()).filter(row => row.length > 0);

      this.innerHTML = '';

      rows.forEach((row, index) => {
          setTimeout(() => { 
              let isIndented = false;

              if (row.startsWith('-')) {
                  row = row.substring(1).trim();
                  isIndented = true;
              }

              let columns = row.split(",").map(col => col.trim());

              let rowElement = document.createElement("span");
              rowElement.classList.add("ingredient-details-content");

              if (isIndented) {
                  rowElement.classList.add("indented");
              }

              columns.forEach(col => {
                  let colElement = document.createElement("span");
                  colElement.innerHTML = col;
                  rowElement.appendChild(colElement);
              });

              this.appendChild(rowElement);
          }, index * 10); 
      });
  }
}

customElements.define("ingredient-details", IngredientDetails);

// AOS Init

document.addEventListener("DOMContentLoaded", function () {
  const initializeAOS = () => {
    if (typeof AOS !== "undefined" && typeof AOS.init === "function") {
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      const options = {
        offset: isSafari ? -200 : 100,
        debounceDelay: isSafari ? 0 : 50,
        duration: 700,
        once: true
      };
      AOS.init(options);
    }
  };

  initializeAOS();

  document.addEventListener("shopify:section:load", initializeAOS);

  document.addEventListener("shopify:section:deselect", function () {
    if (typeof AOS !== "undefined") {
      AOS.init({ offset: -700 });
    }
  });

  const removeAOSClass = (selector) => {
    const drawer = document.getElementById(selector);
    if (drawer) {
      const animatedElements = drawer.querySelectorAll('.aos-animate');
      animatedElements.forEach((element) => {
        element.classList.remove('aos-animate');
      });
    }
  };
  removeAOSClass('CartDrawer');
  removeAOSClass('FilterDrawer');
});


// Heading Underline
document.addEventListener("DOMContentLoaded", function() {
  const animatedTextElements = document.querySelectorAll(".animated-highlight em");

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
      } else {
        entry.target.classList.remove("in-view"); 
      }
    });
  }, { threshold: 0.5 }); 

  animatedTextElements.forEach(element => observer.observe(element));
});