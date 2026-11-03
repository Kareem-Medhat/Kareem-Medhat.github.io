import { el } from "../ui.js";

const toWords = (text) => {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word !== "");
};

// Every typed word must appear somewhere, so "4070 super" and "x3d" both match.
const isMatch = ({ label, queryWords }) => {
  const lowerLabel = label.toLowerCase();
  return queryWords.every((word) => lowerLabel.includes(word));
};

// Typed words that start a word in the label rank higher, so "rtx 50" lists the 5060 before the 3050.
const toRank = ({ label, queryWords }) => {
  const labelWords = toWords(label);
  return queryWords.filter((word) => {
    return labelWords.some((labelWord) => labelWord.startsWith(word));
  }).length;
};

const toMatches = ({ options, query }) => {
  const queryWords = toWords(query);
  return options
    .filter((option) => {
      return isMatch({ label: option.label, queryWords });
    })
    .map((option) => {
      return { option, rank: toRank({ label: option.label, queryWords }) };
    })
    .toSorted((a, b) => b.rank - a.rank)
    .map(({ option }) => option);
};

// WAI-ARIA "list autocomplete with manual selection" combobox. The chosen value lives in a
// hidden form input, so the form reads it like any other field.
export class Combobox {
  #input;
  #toggle;
  #listbox;
  #empty;
  #valueInput;
  #options = [];
  #visibleOptions = [];
  #selectedValue = undefined;
  #activeIndex = undefined;
  #isOpen = false;

  constructor({ input, toggle, listbox, empty, valueInput }) {
    this.#input = input;
    this.#toggle = toggle;
    this.#listbox = listbox;
    this.#empty = empty;
    this.#valueInput = valueInput;

    input.addEventListener("input", (event) => {
      // Typing only filters the list; the form updates once an option is chosen.
      event.stopPropagation();
      this.#open({ query: input.value });
    });
    input.addEventListener("keydown", (event) => this.#onKeyDown(event));
    input.addEventListener("click", () => {
      // Select the shown name, so typing replaces it instead of editing it.
      input.select();
      this.#open({ query: "" });
    });
    input.addEventListener("blur", () => this.#close());
    // Keep focus in the text field, otherwise its blur closes the list before the click toggles it.
    toggle.addEventListener("mousedown", (event) => event.preventDefault());
    toggle.addEventListener("click", () => {
      input.focus();
      if (this.#isOpen) {
        this.#close();
        return;
      }
      this.#open({ query: "" });
    });
    // Keep focus in the text field while the mouse picks an option.
    listbox.addEventListener("mousedown", (event) => event.preventDefault());
    listbox.addEventListener("click", (event) => {
      const index = this.#toOptionIndex(event.target);
      if (index !== undefined) {
        this.#choose(this.#visibleOptions[index]);
      }
    });
    listbox.addEventListener("mousemove", (event) => {
      const index = this.#toOptionIndex(event.target);
      if (index !== undefined && index !== this.#activeIndex) {
        this.#activeIndex = index;
        this.#render();
      }
    });
  }

  replaceOptions({ options, selectedValue, placeholder }) {
    this.#options = options;
    this.#selectedValue = options.some((option) => option.value === selectedValue) ? selectedValue : undefined;
    this.#input.setAttribute("placeholder", placeholder);
    this.#setValueInput(this.#selectedValue ?? "");
    if (this.#isOpen) {
      this.#open({ query: this.#input.value });
      return;
    }
    this.#showSelectedLabel();
  }

  #open({ query }) {
    this.#isOpen = true;
    this.#visibleOptions = toMatches({ options: this.#options, query });
    const selectedIndex = this.#visibleOptions.findIndex((option) => option.value === this.#selectedValue);
    this.#activeIndex = this.#visibleOptions.length === 0 ? undefined : Math.max(selectedIndex, 0);
    this.#render();
  }

  #close() {
    this.#isOpen = false;
    this.#activeIndex = undefined;
    this.#showSelectedLabel();
    this.#render();
  }

  #choose(option) {
    this.#selectedValue = option.value;
    this.#setValueInput(option.value);
    this.#close();
    this.#valueInput.dispatchEvent(new Event("input", { bubbles: true }));
  }

  #moveActive(step) {
    if (!this.#isOpen) {
      this.#open({ query: "" });
      return;
    }
    if (this.#activeIndex === undefined) {
      return;
    }
    const lastIndex = this.#visibleOptions.length - 1;
    this.#activeIndex = Math.min(Math.max(this.#activeIndex + step, 0), lastIndex);
    this.#render();
  }

  #onKeyDown(event) {
    const handlers = {
      ArrowDown: () => this.#moveActive(1),
      ArrowUp: () => this.#moveActive(-1),
      Enter: () => {
        if (this.#isOpen && this.#activeIndex !== undefined) {
          this.#choose(this.#visibleOptions[this.#activeIndex]);
        }
      },
      Escape: () => this.#close(),
    };
    const handler = handlers[event.key];
    if (handler === undefined) {
      return;
    }
    // Enter would submit the form and the arrows would move the text cursor.
    event.preventDefault();
    handler();
  }

  #toOptionIndex(target) {
    const option = target instanceof Element ? target.closest('[role="option"]') : null;
    if (option === null) {
      return undefined;
    }
    return Number(option.getAttribute("data-index"));
  }

  #showSelectedLabel() {
    const selected = this.#options.find((option) => option.value === this.#selectedValue);
    // style-exception: §4, an input's current text can only be set through its value property
    this.#input.value = selected?.label ?? "";
  }

  #setValueInput(value) {
    // style-exception: §4, an input's current value can only be set through its value property
    this.#valueInput.value = value;
  }

  #render() {
    const listboxId = this.#listbox.id;
    const items = this.#visibleOptions.map((option, index) => {
      const classes = [
        index === this.#activeIndex ? "is-active" : "",
        option.value === this.#selectedValue ? "is-current" : "",
      ].filter((name) => name !== "");
      return el("li", {
        attrs: {
          id: `${listboxId}-${index}`,
          role: "option",
          class: classes.join(" "),
          "data-index": String(index),
          "aria-selected": String(index === this.#activeIndex),
        },
        children: [option.label],
      });
    });
    this.#listbox.replaceChildren(...items);
    this.#listbox.toggleAttribute("hidden", !this.#isOpen || items.length === 0);
    this.#empty.toggleAttribute("hidden", !this.#isOpen || items.length > 0);
    this.#input.setAttribute("aria-expanded", String(this.#isOpen && items.length > 0));
    this.#toggle.setAttribute("aria-expanded", String(this.#isOpen && items.length > 0));
    if (this.#activeIndex === undefined) {
      this.#input.removeAttribute("aria-activedescendant");
      return;
    }
    this.#input.setAttribute("aria-activedescendant", `${listboxId}-${this.#activeIndex}`);
    items[this.#activeIndex].scrollIntoView({ block: "nearest" });
  }
}
