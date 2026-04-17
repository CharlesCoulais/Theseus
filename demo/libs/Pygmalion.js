import { Aphrodite } from "./Aphrodite.js";


const waitFor = (delay) => new Promise(resolve => setTimeout(resolve, delay));


const setAnimationFrameTimeout = (fn, timeout) => {
  let running = true;
  let start = null;
  let savedElapsed = 0;
  let elapsed = 0;
  let ended = false;

  const count = (timestamp) => {
    start ??= timestamp;
    elapsed = savedElapsed + (timestamp - start);
    ended = elapsed >= timeout;

    if (ended) {
      running = false;
      return fn();
    }

    if (running) {
      reqId = requestAnimationFrame(count);
    }
  };

  let reqId = requestAnimationFrame(count);

  return {
    stop() {
      cancelAnimationFrame(reqId);
      running = false;
      savedElapsed = 0;
      start = null;
      return this;
    },
    pause() {
      cancelAnimationFrame(reqId);
      running = false;
      start = null;
      savedElapsed = elapsed;
      return this;
    },
    continue() {
      if (running || ended) {
        return this;
      }
      running = true;
      reqId = requestAnimationFrame(count);
      return this;
    },
  };
};


const createAnimationFrameLoop = (fn) => {
  let running = true;
  let start = null;
  let savedElapsed = 0;
  let elapsed = 0;

  const count = (timestamp) => {
    start ??= timestamp;
    elapsed = savedElapsed + (timestamp - start);

    fn({
      timestamp,
      elapsed,
    }, api);

    if (running) {
      reqId = requestAnimationFrame(count);
    }
  };

  let reqId = requestAnimationFrame(count);

  const api = {
    stop() {
      cancelAnimationFrame(reqId);
      running = false;
      savedElapsed = 0;
      start = null;
      return this;
    },
    pause() {
      cancelAnimationFrame(reqId);
      running = false;
      savedElapsed = elapsed;
      start = null;
      return this;
    },
    continue() {
      if (running) {
        return this;
      }
      running = true;
      reqId = requestAnimationFrame(count);
      return this;
    },
  };

  return api;
}

class Chrono {
  #firstRecord = null;
  #lastRecord = null;
  #savedElapsed =  0;

  get elapsed() {
    if (this.#firstRecord === null) return 0;
    return this.#savedElapsed + this.#lastRecord - this.#firstRecord;
  }

  get isRecording() {
    return this.#firstRecord !== null;
  }
null
  record(ts) {
    this.#firstRecord ??= ts;
    this.#lastRecord = ts;
  }

  pause() {
    this.#savedElapsed = this.elapsed;
    this.#firstRecord = null;
  }

  stop() {
    this.#savedElapsed = 0;
    this.#firstRecord = null;
  }
}

class Timer extends Chrono {
  #duration;

  get elapsed() {
    return Math.min(super.elapsed, this.#duration);
  }

  get ratio() {
    return this.elapsed / this.#duration;
  }

  constructor(duration) {
    super();
    this.#duration = duration;
  }

  record(ts) {
    if (this.elapsed === this.#duration) return;
    super.record(ts);
  }
}


class Resolvable {
  #resolve;
  #reject;
  #promise;

  get promise() {
    return this.#promise;
  }

  constructor() {
    this.#promise = new Promise((resolve, reject) => {
      this.#resolve = resolve;
      this.#reject = reject;
    });
  }

  resolve(value) {
    this.#resolve(value);
  }

  reject(error) {
    this.#reject(error);
  }
}


export class Transition {
  #playing = false;
  #renderFrame = () => {};
  #resolvable = null;

  #duration = 0;
  #delay = 0;
  #speed = 1;
  #playDirection = 1;

  constructor(renderFrameFn, duration = 1, delay = 0) {
    this.#renderFrame = renderFrameFn;
    this.#duration = Math.max(duration, 1);
    this.#delay =  delay;
  }

  #step({ elapsed }) {
    const ratio = Math.min(elapsed / this.#duration, 1);
    this.#renderFrame(ratio);

    if (this.#playing && ratio < 1) {
      return;
    }

    this.stop();
    this.#delayControls = undefined;
    this.#loopControls = undefined;
    this.#resolvable.resolve();
    this.#resolvable = null;
  }

  #delayControls;
  #loopControls;

  async play() {
    if (this.#playing) {
      return;
    }
    this.#playing = true;

    this.#delayControls ??= setAnimationFrameTimeout(() => {
      this.#loopControls ??= createAnimationFrameLoop((...args) => {
        this.#step(...args);
      });
    }, this.#delay);
    
    this.#delayControls?.continue();
    this.#loopControls?.continue();

    this.#resolvable ??= new Resolvable();

    return this.#resolvable.promise;
  }

  pause() {
    if (!this.#playing) {
      return;
    }
    this.#playing = false;
    this.#delayControls?.pause();
    this.#loopControls?.pause();
  }

  continue() {
    if (this.#playing) {
      return;
    }
    this.#playing = true;
    this.#delayControls?.continue();
    this.#loopControls?.continue();
    return this.#resolvable?.promise;
  }

  stop() {
    if (!this.#playing) {
      return;
    }
    this.#playing = false;
    this.#delayControls?.stop();
    this.#loopControls?.stop();
  }
}


export class TransitionEx {
  #frameFn = null;

  #duration = 0;
  #delay = 0;
  #speed = 1;
  #playDirection = 1;

  #timer = null;


  #endPromise = null;

  constructor(frameFn, duration = 0, delay = 0) {
    this.#frameFn = frameFn;
    this.#duration = duration;
    this.#delay = delay;
    this.#timer = new Timer(this.#duration);
  }

  requestTransitionFrame(fn) {
    requestAnimationFrame(timestamp => {
      !this.#timer.record(timestamp);
      fn(this.#timer.ratio);
    });
  }

  async play() {
    if (this.#timer.isRecording) {
      return this.#endPromise;
    }

    let resolveFn = null;
    this.#endPromise = new Promise(resolve => resolveFn = resolve);


    const step = (ratio) => {
      this.#frameFn(ratio);

      if (this.#timer.isRecording && ratio < 1) {
        this.requestTransitionFrame(step);
        return;
      }

      this.#endPromise = null;
      resolveFn();
    };
    
    await waitFor(this.#delay);
    this.requestTransitionFrame(step);
    return this.#endPromise;
  }

  pause() {
    this.#timer.pause();
  }

  stop() {
    this.#timer.stop();
  }

}

export class TargetPlaceholder extends DocumentFragment {
  #node = null;
  #startPlaceholder = new PlaceHolderElement();
  #endPlaceholder = new PlaceHolderElement();

  constructor(node) {
    super();
    this.#node = node;

    this.#startPlaceholder.attachToElement(this.#node, true);
    this.#endPlaceholder.attachToElement(this.#node, false);

    super.append(this.#endPlaceholder);
  }

  init() {
    this.#startPlaceholder.replaceAttached();
  }

  start() {
    this.#startPlaceholder.hide();
    this.#endPlaceholder.show();
  }
  
  step(stepRatio) {
    this.#startPlaceholder.step(1 - stepRatio);
    this.#endPlaceholder.step(stepRatio);
  }

  end() {
    this.#endPlaceholder.renderAttached();
    this.#startPlaceholder.remove();
    super.append(this.#endPlaceholder);
  }

  getDistanceOffset() {
    const startOffset = this.#startPlaceholder.getGlobalOffset();
    const endOffset = this.#endPlaceholder.getGlobalOffset();

    return {
      top: endOffset.top - startOffset.top,
      left: endOffset.left - startOffset.left,
    }
  }
}

class PlaceHolderElement extends Text {
  #placeholder = (el => el.classList.add(this.#classStore.placeholder) || el)(document.createElement('span'));
  #attached = null;
  #fullSize = {
    width: 0,
    height: 0,
    margin: 0,
  };

  get #classStore() {
    return PlaceHolderElement.#styleSheet.classStore;
  }

  constructor(element, visible = true) {
    super();
    if (element) {
      this.attachToElement(element);
    }

    if (visible === false) {
      this.#placeholder.classList.add(this.#classStore.hidden);
    }
  }

  attachToElement(element) {
    this.#attached = element;
    this.#copyCat(element);
    element.replaceWith(this, element);
    return this;
  }

  #copyCat(element) {
    const elStyle =  window.getComputedStyle(element);

    this.#fullSize = {
      width: element.offsetWidth,
      height: element.offsetHeight,
      marginLeft: parseInt(elStyle.marginLeft),
      marginRight: parseInt(elStyle.marginRight),
      marginTop: parseInt(elStyle.marginTop),
      marginBottom: parseInt(elStyle.marginBottom),
    };
  }

  replaceAttached() {
    Aphrodite(this.#placeholder).style = this.#fullSize;
    this.#placeholder.append(this.#attached);
    this.replaceWith(this, this.#placeholder);
  }

  renderAttached() {
    this.#placeholder.replaceWith();
    this.replaceWith(this, this.#attached);
  }

  show() {
    this.replaceWith(this, this.#placeholder);

    setTimeout(() => this.#placeholder.classList.remove(this.#classStore.hidden), 200);
  }

  hide() {
    this.replaceWith(this, this.#placeholder);
    setTimeout(() => this.#placeholder.classList.add(this.#classStore.hidden), 200);
  }

  step(stepRatio) {
    Aphrodite(this.#placeholder).style = {
      width: this.#fullSize.width * stepRatio + 'px',
      height: this.#fullSize.height * stepRatio + 'px',
      marginLeft: this.#fullSize.marginLeft * stepRatio + 'px',
      marginRight: this.#fullSize.marginRight * stepRatio + 'px',
      marginTop: this.#fullSize.marginTop * stepRatio + 'px',
      marginBottom: this.#fullSize.marginBottom * stepRatio + 'px',
    };
  }

  remove() {
    this.#placeholder.replaceWith();
  }

  getGlobalOffset() {
    this.replaceWith(this, this.#placeholder);
    let node = this.#placeholder;

    const offset = {
      top: node.offsetTop,
      left: node.offsetLeft,
    };

    while (node.offsetParent) {
      node = node.offsetParent;
      offset.top += node.offsetTop;
      offset.left += node.offsetLeft;
    }

    return offset;
  }

  static #styleSheet = Aphrodite.createStyleSheet({
    '.placeholder': {
      padding: '0!',
      opacity: 1,
      transition: 'all 1s',
      //border: '1px solid red',
      backgroundColor: 'transparent',
    },
    '.placeholder.hidden': {
      width: '0!',
      height: '0!',
      margin: 0,
    },
    '.placeholder > *': {
      margin: '0!',
    }
  });
}

export function translate(node, placeholder) {
  placeholder.init();
  let targetOffset = null;

  return (stepRatio) => {
    if (stepRatio === 0) {
      node.style.position = 'absolute';
    }

    placeholder.step(stepRatio);

    targetOffset = placeholder.getDistanceOffset();

    Aphrodite(node).style = {
      top: (targetOffset.top * stepRatio) + 'px',
      left: (targetOffset.left * stepRatio) + 'px',
    };

    if (stepRatio < 1) {
      return;
    }

    Aphrodite(node).style = {
      top: 0,
      left: 0,
      position: ''
    };

    placeholder.end();
  };
}

export function scale(node, ratio) {
  const initialState = {
    width: node.offsetWidth,
    height: node.offsetHeight,
  };

  return (stepRatio) => {
    Aphrodite(node).style = {
      width: (initialState.width * ratio * stepRatio) + 'px',
      height: (initialState.height * ratio * stepRatio) + 'px',
    };
  }
}

