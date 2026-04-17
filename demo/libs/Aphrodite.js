
function aphroditeFunction(...args) {
  const elements = aphroArgsToElementList(args);
  return createStyleSetterProxy(elements);
}

function aphroArgsToElementList(args) {
  return args
    .map(arg => {
      if (arg instanceof HTMLElement) {
        return arg;
      }
      if (typeof arg === 'string') {
        return arg.endsWith('::all')
          ? [...window.document.querySelectorAll(arg.replace(/::all$/, ''))]
          : window.document.querySelector(arg);
      }
      return null;
    })
    .flat()
    .filter(Boolean);
}

function createStyleSetterProxy(elements) {
  return new Proxy(elements[0], {
    set(target, key, value, proxy) {
      if (key === 'style' && typeof value === 'object') {
        elements.forEach(element => setElementStyle(element, value));
        return true;
      }

      target[key] = value;

      return true;
    }
  });
}

function setElementStyle(element, propObj) {
  Object.entries(propObj)
    .forEach(([rawPropertyName, propertyValue]) => {
      const propertyName = rawPropertyName.replace(/-([a-z])/g, (match, capture) => capture.toUpperCase());
      element.style[propertyName] = propertyValue;
    });
}


export function createStyleSheet(rulesObj, prefix) {
  const styleSheet = new AphroditeStyleSheet(prefix, rulesObj).beAdoptedBy();

  return new Proxy(styleSheet, {
    get(target, key, proxy) {
      if (key in target) {
        return (typeof styleSheet[key] === 'function')
          ? (...args) => styleSheet[key](...args)
          : styleSheet[key];
      }
    },
    
    set(target, ruleSelector, propertiesObject, proxy) {
      if (ruleSelector in CSSStyleSheet.prototype) {
        const key = ruleSelector;
        const value = propertiesObject;
        target[key] = value;
      }
      
      styleSheet.insertRule(ruleSelector, propertiesObject);

      return true;
    },
  });
}


export class AphroditeStyleSheet extends CSSStyleSheet {
  #classRegistry = new ClassNameRegistry();

  get classStore() {
    return this.#classRegistry.toProxy();
  }

  constructor(prefix = null, rulesObject = null) {
    super();
    this.#classRegistry = new ClassNameRegistry(prefix);
    rulesObject && this.replace(rulesObject);
  }

  insertRule(selector, propObj) {
    const ruleStr = this.#propObjectToString(selector, propObj);

    return super.insertRule(ruleStr);
  }

  replace(rulesObject) {
    const contentStr = this.#rulesObjectToString(rulesObject);
    return super.replace(contentStr);
  }

  replaceSync(rulesObject) {
    const contentStr = this.#rulesObjectToString(rulesObject);
    return super.replaceSync(contentStr);
  }

  beAdoptedBy(doc = document) {
    doc.adoptedStyleSheets = [...doc.adoptedStyleSheets.filter(styleSheet => styleSheet !== this), this];
    return this;
  }

  beDeniedBy(doc = document) {
    doc.adoptedStyleSheets = doc.adoptedStyleSheets.filter(styleSheet => styleSheet !== this);
    return this;
  }

  getClassList() {
    return [...this.#classRegistry];
  }

  #rulesObjectToString(rulesObject) {
    if (typeof rulesObject !== 'object') {
      return rulesObject;
    }

    return Object.entries(rulesObject)
      .map(([selector, propObj]) => this.#propObjectToString(selector, propObj))
      .join('\n');
  }

  #propObjectToString(selector, propObj) {
    if (typeof propObj !== 'object') {
      return propObj;
    }
    
    const encodedSelector = this.#encodeSelector(selector);

    const propertiesStr = Object.entries(propObj)
      .map(([rawPropertyName, rawPropertyValue]) => {
        const propertyName = rawPropertyName.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`);
        const propertyValue = rawPropertyValue.toString().replace(/\!$/, '!important');
        return `  ${propertyName}: ${propertyValue};`;
      })
      .join('\n');
    
    return `${encodedSelector} {\n${propertiesStr}\n}`;
  }

  #encodeSelector(selector) {
    return selector.replace(/(\.[\w-]+)/g, match => {
      const className = match.substring(1);
      return '.' + this.#classRegistry.register(className);
    });
  }

  *[Symbol.iterator]() {
    for (const rule of this.cssRules) {
      yield rule.cssText;
    }
  }
}

class ClassNameRegistry {
  #uniqPrefix = ClassNameRegistry.#createUniqKey() + '_';
  #nameSet = new Set();
  #registry = new Map();

  static #uniqKeySet = new Set();

  constructor(prefix = null) {
    if (prefix?.length) {
      this.#uniqPrefix = `${prefix}_`;
    }

    if (prefix === '') {
      this.#uniqPrefix = '';
    }
  }

  register(classNameStr) {
    this.#nameSet.add(classNameStr);
    const encodedName = this.#encodeName(classNameStr)
    this.#registry.set(classNameStr, encodedName);
    return encodedName;
  }

  getClassName(classNameStr) {
    if (!this.#nameSet.has(classNameStr)) {
      return;
    }
    return this.#registry.get(classNameStr);
  }

  toProxy() {
    return new Proxy(this, {
      get(target, className, value) {
        if (className === Symbol.iterator) {
          return () => target[Symbol.iterator]();
        }
        return target.getClassName(className);
      }
    });
  }

  #encodeName(className) {
    return this.#uniqPrefix + className;
  }

  static #createUniqKey() {
    let uniqName = undefined;

    while (!uniqName || ClassNameRegistry.#uniqKeySet.has(uniqName)) {
      uniqName = ClassNameRegistry.#generateKey();
    }

    ClassNameRegistry.#uniqKeySet.add(uniqName);
    return uniqName;
  }

  static #generateKey() {
    return (x => x.substring(x.length - 5))(((Date.now() * 1000) + (Math.round(Math.random() * 1000))).toString(36));
  }

  *[Symbol.iterator]() {
    for (const className of this.#nameSet) {
      yield className;
    }
  }
}

export const Aphrodite = new Proxy(aphroditeFunction, {
    get(target, key, proxy) {
      if (key === 'createStyleSheet') {
        return createStyleSheet;
      }
      return undefined;
    }
  }
);
