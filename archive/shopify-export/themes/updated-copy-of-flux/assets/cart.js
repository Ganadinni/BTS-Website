class CartRemoveButton extends HTMLElement {
  constructor() {
    super();

    this.addEventListener("click", (event) => {
      event.preventDefault();
      const cartItems =
        this.closest("cart-items") || this.closest("cart-drawer-items");

      const observer = new MutationObserver(() => {
        if (!cartItems.querySelector("[data-index]")) {
          updateCartLayout(); 
          observer.disconnect(); 
        }
      });

      observer.observe(cartItems, { childList: true, subtree: true });
      cartItems.updateQuantity(this.dataset.index, 0);
    });
  }
}

customElements.define("cart-remove-button", CartRemoveButton);

class CartItems extends HTMLElement {
  constructor() {
    super();
    this.lineItemStatusElement =
      document.getElementById("shopping-cart-line-item-status") ||
      document.getElementById("CartDrawer-LineItemStatus");

    const debouncedOnChange = debounce((event) => {
      this.onChange(event);
    }, ON_CHANGE_DEBOUNCE_TIMER);

    this.addEventListener("change", debouncedOnChange.bind(this));
  }

  cartUpdateUnsubscriber = undefined;

  connectedCallback() {
    this.cartUpdateUnsubscriber = subscribe(
      PUB_SUB_EVENTS.cartUpdate,
      (event) => {
        if (event.source === "cart-items") {
          return;
        }
        this.onCartUpdate();
      }
    );
  }

  disconnectedCallback() {
    if (this.cartUpdateUnsubscriber) {
      this.cartUpdateUnsubscriber();
    }
  }

  onChange(event) {
    this.updateQuantity(
      event.target.dataset.index,
      event.target.value,
      document.activeElement.getAttribute("name")
    );
  }

 onCartUpdate() {
  // Check if the cart-items custom element exists
  const cartItems = document.querySelector('cart-items');

  if (this.tagName === 'CART-DRAWER-ITEMS') {
    fetch(`${routes.cart_url}?section_id=cart-drawer`)
      .then((response) => response.text())
      .then((responseText) => {
        const html = new DOMParser().parseFromString(responseText, 'text/html');
        const selectors = ['cart-drawer-items', '.cart-drawer__footer'];
        for (const selector of selectors) {
          const targetElement = document.querySelector(selector);
          const sourceElement = html.querySelector(selector);
          if (targetElement && sourceElement) {
            targetElement.replaceWith(sourceElement);
          }
        }
        if (typeof AOS !== "undefined") {
          AOS.init();
        }
      })  
      .catch((e) => {
        console.error(e);
      });
  } else {
    fetch(`${routes.cart_url}?section_id=main-cart-items`)
      .then((response) => response.text())
      .then((responseText) => {
        const html = new DOMParser().parseFromString(responseText, 'text/html');
        const sourceQty = html.querySelector('cart-items');
        if (sourceQty) {
          this.innerHTML = sourceQty.innerHTML;
        }
      })
      .catch((e) => {
        console.error(e);
      });
  }

  // Reload the page if the cart-items element is present
  if (cartItems) {
    window.location.reload();
  }
}

  getSectionsToRender() {
    return [
      {
        id: "main-cart-items",
        section: document.getElementById("main-cart-items").dataset.id,
        selector: ".js-contents",
      },
      {
        id: "cart-icon-bubble",
        section: "cart-icon-bubble",
        selector: ".shopify-section",
      },
      {
        id: "cart-live-region-text",
        section: "cart-live-region-text",
        selector: ".shopify-section",
      },
      {
        id: "main-cart-footer",
        section: document.getElementById("main-cart-footer").dataset.id,
        selector: ".js-contents",
      },
    ];
  }

  updateQuantity(line, quantity, name) {
    this.enableLoading(line);

    const body = JSON.stringify({
      line,
      quantity,
      sections: this.getSectionsToRender().map((section) => section.section),
      sections_url: window.location.pathname,
    });

    fetch(`${routes.cart_change_url}`, { ...fetchConfig(), ...{ body } })
      .then((response) => {
        return response.text();
      })
      .then((state) => {
        const parsedState = JSON.parse(state);
        const quantityElement =
          document.getElementById(`Quantity-${line}`) ||
          document.getElementById(`Drawer-quantity-${line}`);
        const items = document.querySelectorAll(".cart-item");

        if (parsedState.errors) {
          quantityElement.value = quantityElement.getAttribute("value");
          this.updateLiveRegions(line, parsedState.errors);
          return;
        }

        this.classList.toggle("is-empty", parsedState.item_count === 0);
        const cartDrawerWrapper = document.querySelector("cart-drawer");
        const cartFooter = document.getElementById("main-cart-footer");

        if (cartFooter)
          cartFooter.classList.toggle("is-empty", parsedState.item_count === 0);
        if (cartDrawerWrapper)
          cartDrawerWrapper.classList.toggle(
            "is-empty",
            parsedState.item_count === 0
          );

        this.getSectionsToRender().forEach((section) => {
          const elementToReplace =
            document
              .getElementById(section.id)
              .querySelector(section.selector) ||
            document.getElementById(section.id);
          elementToReplace.innerHTML = this.getSectionInnerHTML(
            parsedState.sections[section.section],
            section.selector
          );
        });
        const updatedValue = parsedState.items[line - 1]
          ? parsedState.items[line - 1].quantity
          : undefined;
        let message = "";
        if (
          items.length === parsedState.items.length &&
          updatedValue !== parseInt(quantityElement.value)
        ) {
          if (typeof updatedValue === "undefined") {
            message = window.cartStrings.error;
          } else {
            message = window.cartStrings.quantityError.replace(
              "[quantity]",
              updatedValue
            );
          }
        }
        this.updateLiveRegions(line, message);

        const lineItem =
          document.getElementById(`CartItem-${line}`) ||
          document.getElementById(`CartDrawer-Item-${line}`);
        if (lineItem && lineItem.querySelector(`[name="${name}"]`)) {
          cartDrawerWrapper
            ? trapFocus(
                cartDrawerWrapper,
                lineItem.querySelector(`[name="${name}"]`)
              )
            : lineItem.querySelector(`[name="${name}"]`).focus();
        } else if (parsedState.item_count === 0 && cartDrawerWrapper) {
          trapFocus(
            cartDrawerWrapper.querySelector(".drawer-inner-empty"),
            cartDrawerWrapper.querySelector("a")
          );
        } else if (document.querySelector(".cart-item") && cartDrawerWrapper) {
          trapFocus(
            cartDrawerWrapper,
            document.querySelector(".cart-item-name")
          );
        }
        publish(PUB_SUB_EVENTS.cartUpdate, { source: "cart-items" });
      })
      .catch(() => {
        this.querySelectorAll(".loading-overlay").forEach((overlay) =>
          overlay.classList.add("hidden")
        );
        const errors =
          document.getElementById("cart-errors") ||
          document.getElementById("CartDrawer-CartErrors");
        errors.textContent = window.cartStrings.error;
      })
      .finally(() => {
        this.disableLoading(line);
      });
  }

  updateLiveRegions(line, message) {
    const lineItemError =
      document.getElementById(`Line-item-error-${line}`) ||
      document.getElementById(`CartDrawer-LineItemError-${line}`);
    if (lineItemError)
      lineItemError.querySelector(".cart-item-error-text").innerHTML = message;

    this.lineItemStatusElement.setAttribute("aria-hidden", true);

    const cartStatus =
      document.getElementById("cart-live-region-text") ||
      document.getElementById("CartDrawer-LiveRegionText");
    cartStatus.setAttribute("aria-hidden", false);

    setTimeout(() => {
      cartStatus.setAttribute("aria-hidden", true);
    }, 1000);
  }

  getSectionInnerHTML(html, selector) {
    return new DOMParser()
      .parseFromString(html, "text/html")
      .querySelector(selector).innerHTML;
  }

  enableLoading(line) {
    const mainCartItems =
      document.getElementById("main-cart-items") ||
      document.getElementById("CartDrawer-CartItems");
    mainCartItems.classList.add("cart__items--disabled");

    const cartItemElements = this.querySelectorAll(
      `#CartItem-${line} .loading-overlay`
    );
    const cartDrawerItemElements = this.querySelectorAll(
      `#CartDrawer-Item-${line} .loading-overlay`
    );

    [...cartItemElements, ...cartDrawerItemElements].forEach((overlay) =>
      overlay.classList.remove("hidden")
    );

    document.activeElement.blur();
    this.lineItemStatusElement.setAttribute("aria-hidden", false);
  }

  disableLoading(line) {
    const mainCartItems =
      document.getElementById("main-cart-items") ||
      document.getElementById("CartDrawer-CartItems");
    mainCartItems.classList.remove("cart__items--disabled");

    const cartItemElements = this.querySelectorAll(
      `#CartItem-${line} .loading-overlay`
    );
    const cartDrawerItemElements = this.querySelectorAll(
      `#CartDrawer-Item-${line} .loading-overlay`
    );

    cartItemElements.forEach((overlay) => overlay.classList.add("hidden"));
    cartDrawerItemElements.forEach((overlay) =>
      overlay.classList.add("hidden")
    );
  }
}

customElements.define("cart-items", CartItems);

if (!customElements.get("cart-note")) {
  customElements.define(
    "cart-note",
    class CartNote extends HTMLElement {
      constructor() {
        super();

        this.addEventListener(
          "change",
          debounce((event) => {
            const body = JSON.stringify({ note: event.target.value });
            fetch(`${routes.cart_update_url}`, {
              ...fetchConfig(),
              ...{ body },
            });
          }, ON_CHANGE_DEBOUNCE_TIMER)
        );
      }
    }
  );
}

// Terms Checkbox

class TermsCheckbox extends HTMLElement {
  constructor() {
    super();
    this.checkbox = null;
    this.checkoutButtons = null;
  }

  connectedCallback() {
    this.checkbox = this.querySelector("#termsCheckbox");
    this.checkoutButtons = document.querySelectorAll(".cart-checkout-button");

    this.restoreCheckboxState();
    this.checkbox.addEventListener("change", this.updateState.bind(this));

    // Subscribe to cart updates
    this.cartUpdateUnsubscriber = subscribe(
      PUB_SUB_EVENTS.cartUpdate,
      this.reinitializeCheckbox.bind(this)
    );
  }

  disconnectedCallback() {
    if (this.cartUpdateUnsubscriber) {
      this.cartUpdateUnsubscriber();
    }
  }

  updateState() {
    if (this.checkoutButtons.length) {
      this.checkoutButtons.forEach((button) => {
        if (this.checkbox.checked) {
          button.removeAttribute("disabled");
        } else {
          button.setAttribute("disabled", "disabled");
        }
      });
      if (this.checkbox.checked) {
      this.checkoutButtons[0].focus();
    }
    }
    this.saveCheckboxState();
  }

  saveCheckboxState() {
    localStorage.setItem(
      "termsCheckboxState",
      this.checkbox.checked ? "checked" : "unchecked"
    );
  }

  restoreCheckboxState() {
    const savedState = localStorage.getItem("termsCheckboxState");
    this.checkbox.checked = savedState === "checked";
    this.updateState();
  }

  reinitializeCheckbox() {
    this.checkbox = this.querySelector("#termsCheckbox");
    this.restoreCheckboxState();

    if (typeof AOS !== "undefined") {
      AOS.init();
    }
  }
}

customElements.define("terms-checkbox", TermsCheckbox);

// Cart Note

class CustomDropdown extends HTMLElement {
  constructor() {
    super();
    this.dropdownHeader = this.querySelector(".dropdown-header");
    this.dropdownContent = this.querySelector(".dropdown-content");

    if (this.dropdownHeader && this.dropdownContent) {
      this.dropdownHeader.addEventListener("click", () =>
        this.toggleDropdown()
      );
    }
  }
  toggleDropdown() {
    const isOpen = this.dropdownContent.classList.contains("open");

    // Close all dropdowns
    document
      .querySelectorAll("custom-dropdown .dropdown-content")
      .forEach((content) => {
        content.classList.remove("open");
      });
    document
      .querySelectorAll("custom-dropdown .dropdown-header")
      .forEach((header) => {
        header.classList.remove("open");
      });

    // Open the current one
    if (!isOpen) {
      this.dropdownContent.classList.add("open");
      this.dropdownHeader.classList.add("open");
    }
    if (typeof AOS !== "undefined") {
      AOS.init();
    }
  }
  connectedCallback() {}
  disconnectedCallback() {
    if (this.dropdownHeader) {
      this.dropdownHeader.removeEventListener("click", this.toggleDropdown);
    }
  }
}
customElements.define("custom-dropdown", CustomDropdown);

class ShippingMessage extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.render();
  }

  render() {

    this.innerHTML = '';
    const threshold = parseFloat(this.getAttribute('data-threshold'));
    const cartTotal = parseFloat(this.getAttribute('data-cart-total'));
    const messageBefore = this.getAttribute('data-message-before');
    const messageAfter = this.getAttribute('data-message-after');
    const messageSuccess = this.getAttribute('data-message-success');
    const currencyRate = Shopify.currency.rate || 1;

    const convertedThreshold = threshold * currencyRate;
    let remainingAmount = Math.max(0, convertedThreshold - cartTotal);

    remainingAmount = remainingAmount.toFixed(2);

    function formatCurrency(amount, currency) {
      const options = { style: 'currency', currency: currency };
      return new Intl.NumberFormat('en-US', options).format(amount);
    }

    const messageElement = document.createElement('div');
    
    if (remainingAmount > 0) {
      messageElement.innerHTML = `${messageBefore}<span class="amount-bold" id="free-shipping-amount">${formatCurrency(remainingAmount, Shopify.currency.active)}</span>${messageAfter}`;
    } else {
      messageElement.innerHTML = `${messageSuccess}`;
    }

    this.appendChild(messageElement);
  }
}

customElements.define('shipping-message', ShippingMessage);