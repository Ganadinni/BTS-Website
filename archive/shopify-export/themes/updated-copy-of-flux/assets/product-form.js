if (!customElements.get("product-form")) {
  customElements.define(
    "product-form",
    class ProductForm extends HTMLElement {
      constructor() {
        super();

        this.form = this.querySelector("form");
        this.form.querySelector("[name=id]").disabled = false;
        this.form.addEventListener("submit", this.onSubmitHandler.bind(this));
        this.cart =
          document.querySelector("cart-notification") ||
          document.querySelector("cart-drawer");
        this.submitButton = this.querySelector('[type="submit"]');
        if (document.querySelector("cart-drawer"))
          this.submitButton.setAttribute("aria-haspopup", "dialog");
      }

      onSubmitHandler(evt) {
        evt.preventDefault();
        if (this.submitButton.getAttribute("aria-disabled") === "true") return;

        this.handleErrorMessage();

        this.submitButton.setAttribute("aria-disabled", true);

        const config = fetchConfig("javascript");
        config.headers["X-Requested-With"] = "XMLHttpRequest";
        delete config.headers["Content-Type"];

        const formData = new FormData(this.form);
        if (this.cart) {
          formData.append(
            "sections",
            this.cart.getSectionsToRender().map((section) => section.id)
          );
          formData.append("sections_url", window.location.pathname);
          this.cart.setActiveElement(document.activeElement);
        }
        config.body = formData;

        fetch(`${routes.cart_add_url}`, config)
          .then((response) => response.json())
          .then((response) => {
            if (response.status) {
              this.handleErrorMessage(response.description);

              const soldOutMessage =
                this.submitButton.querySelector(".sold-out-message");
              if (!soldOutMessage) return;
              this.submitButton.setAttribute("aria-disabled", true);
              this.submitButton.querySelector("span").classList.add("hidden");
              soldOutMessage.classList.remove("hidden");
              this.error = true;
              return;
            } else if (!this.cart) {
              window.location = window.routes.cart_url;
              return;
            }

            if (!this.error)
              publish(PUB_SUB_EVENTS.cartUpdate, { source: "product-form" });
            this.error = false;
            const quickAddModal = this.closest("quick-add-modal");
            if (quickAddModal) {
              document.body.addEventListener(
                "modalClosed",
                () => {
                  setTimeout(() => {
                    this.cart.renderContents(response);
                  });
                },
                { once: true }
              );
              quickAddModal.hide(true);
              if (typeof AOS !== "undefined") {
                AOS.init();
              }
            } else {
              this.cart.renderContents(response);
              if (typeof AOS !== "undefined") {
                AOS.init();
              }
            }
          })
          .catch((e) => {
            console.error(e);
          })
          .finally(() => {
            this.submitButton.classList.remove("loading");
            if (this.cart && this.cart.classList.contains("is-empty"))
              this.cart.classList.remove("is-empty");
            if (!this.error) this.submitButton.removeAttribute("aria-disabled");
            if (typeof AOS !== "undefined") {
              AOS.init();
            }
          });
      }

      handleErrorMessage(errorMessage = false) {
        if (this.hideErrors) return;

        this.errorMessageWrapper =
          this.errorMessageWrapper ||
          this.querySelector(".product-form__error-message-wrapper");
        if (!this.errorMessageWrapper) return;
        this.errorMessage =
          this.errorMessage ||
          this.errorMessageWrapper.querySelector(
            ".product-form__error-message"
          );

        this.errorMessageWrapper.toggleAttribute("hidden", !errorMessage);

        if (errorMessage) {
          if (typeof errorMessage === "object") {
            const formattedMessage = Object.entries(errorMessage)
              .map(([field, messages]) => `${field}: ${messages.join(", ")}`)
              .join(" | ");
            this.errorMessage.textContent = formattedMessage;
          } else {
            this.errorMessage.textContent = errorMessage;
          }
        }
      }
    }
  );
  
  let removedElements = {
    mobile: [],
    desktop: [],
  };

  function removeElementsByScreenSize(container = document) {
    if (window.matchMedia("(max-width: 990px)").matches) {
      document.querySelectorAll(".hide-mobile").forEach((el) => {
        removedElements.desktop.push({
          parent: el.parentNode,
          element: el,
          nextSibling: el.nextSibling,
        });
        el.remove();
      });

      removedElements.mobile.forEach(({ parent, element, nextSibling }) => {
        if (nextSibling && nextSibling.parentNode === parent) {
          parent.insertBefore(element, nextSibling);
        } else {
          parent.appendChild(element);
        }
      });
      removedElements.mobile = [];
    } else {
      document.querySelectorAll(".hide-desktop").forEach((el) => {
        removedElements.mobile.push({
          parent: el.parentNode,
          element: el,
          nextSibling: el.nextSibling,
        });
        el.remove();
      });
      removedElements.desktop.forEach(({ parent, element, nextSibling }) => {
        if (nextSibling && nextSibling.parentNode === parent) {
          parent.insertBefore(element, nextSibling);
        } else {
          parent.appendChild(element);
        }
      });
      removedElements.desktop = [];
    }
  }

  removeElementsByScreenSize();
  window.addEventListener("resize", removeElementsByScreenSize);
}

class StickyAddToCart extends HTMLElement {
  constructor() {
    super();
    this._handleResize = this._debounce(
      this.initStickyAddToCart.bind(this),
      200
    );
  }

  connectedCallback() {
    this.initStickyAddToCart();

    window.addEventListener("resize", this._handleResize);
  }

  disconnectedCallback() {
    window.removeEventListener("resize", this._handleResize);
  }

  initStickyAddToCart() {
    const img = this.querySelector(".product-content img");
    const selectField = this.querySelector('select[name="id"]');
    const addButton = this.querySelector('button[name="add"]');
    const productForm = document.querySelector(".product-form");

    if (!selectField || !addButton || !productForm) return;

    const addToCartText = addButton.getAttribute("data-add-to-cart");
    const soldOutText = addButton.getAttribute("data-sold-out");

    const checkVisibility = () => {
    const formRect = productForm.getBoundingClientRect();
    const footer = document.querySelector("footer");
    const footerRect = footer?.getBoundingClientRect();
  
    const isOutOfView = formRect.bottom <= 0;
    const isFooterVisible = footerRect && footerRect.top < window.innerHeight;
  
    if (isOutOfView && !isFooterVisible) {
      this.classList.add("show");
      document.documentElement.style.paddingBottom = `${this.clientHeight}px`;
    } else {
      this.classList.remove("show");
      document.documentElement.style.paddingBottom = "0";
    }
  };

    checkVisibility();

    window.addEventListener("scroll", checkVisibility);

    selectField.addEventListener("change", () => {
      const selectedOption = selectField.options[selectField.selectedIndex];

      if (selectedOption.dataset.img) {
        img.setAttribute("src", selectedOption.dataset.img);
      }

      if (selectedOption.getAttribute("data-available") === "false") {
        addButton.setAttribute("disabled", "true");
        addButton.querySelector("span").textContent = soldOutText;
      } else {
        addButton.removeAttribute("disabled");
        addButton.querySelector("span").textContent = addToCartText;
      }
    });

    document
      .querySelector('.product-form [name="id"]')
      ?.addEventListener("change", (e) => {
        const value = Number(e.target.value);
        if (value) {
          selectField.value = value;
        }
      });
  }

  _debounce(func, wait) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
}

customElements.define("sticky-add-to-cart", StickyAddToCart);