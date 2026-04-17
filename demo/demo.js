
import { Theseus } from '../src/Theseus.js';
import { Transition, TargetPlaceholder, translate } from './libs/Pygmalion.js';

let demoTpl = undefined;
let stateContainer = undefined;
let garbageContainer = undefined;

let runBt = undefined;
let pauseBt = undefined;
let initBt = undefined;

let paramsForm = undefined;

const animationDuration = 500;

window.addEventListener('DOMContentLoaded', e => {
  queryElements();
  prepareDemo();
  addAppEventListeners();
});

function queryElements() {
  demoTpl = document.getElementById('demoTpl');
  garbageContainer = document.getElementById('garbageContainer');
  stateContainer = document.getElementById('stateContainer');
  runBt = document.getElementById('runBt');
  pauseBt = document.getElementById('pauseBt');
  initBt = document.getElementById('initBt');
  paramsForm = document.getElementById('paramsForm');
}

function prepareDemo() {
  const clone = demoTpl.content.cloneNode(true);
  stateContainer.appendChild(clone);
  const root = stateContainer;

  const walker = Theseus.createWalker(
    stateContainer,
    NodeFilter.SHOW_ELEMENT
  );

  while (walker.nextNode()) {
    let node = walker.currentNode;
    let i = 0;
    while (node.parentNode !== root) {
      node = node.parentNode;
      ++i;
    }
    walker.currentNode.classList.add(`level-${i}`);
    walker.currentNode.style.width = walker.currentNode.offsetWidth +'px';
    walker.currentNode.style.height = walker.currentNode.offsetHeight +'px';
  }
}

function addAppEventListeners() {
  paramsForm.addEventListener('input', onParamsUpdate);
  runBt.addEventListener('click', runDemo);
  pauseBt.addEventListener('click', pauseDemo);
  initBt.addEventListener('click', initDemo);
}

let walkerFilter = NodeFilter.SHOW_ELEMENT;

function onParamsUpdate() {
  walkerFilter = [...paramsForm.elements]
    .filter(el => el.checked)
    .map(el => el.value)
    .reduce((filter, key) => filter | Theseus.NodeFilter[key], NodeFilter.SHOW_ELEMENT);
}


let animationRunners = [];

function initDemo() {
  initBt.setAttribute('disabled', '');
  pauseBt.setAttribute('disabled', '');
  runBt.removeAttribute('disabled');

  garbageContainer.innerHTML = '';
  stateContainer.innerHTML = '';
  prepareDemo();

  animationRunners = [];

  console.clear?.();
}

function pauseDemo() {
  animationRunners.flat().forEach(tansition => tansition.pause());
  runBt.removeAttribute('disabled');
  pauseBt.setAttribute('disabled', '');
}

function playDemo() {
  runBt.setAttribute('disabled', '');
  animationRunners.flat().forEach(transition => transition.continue());
}

async function runDemo() {
  runBt.setAttribute('disabled', '');
  initBt.removeAttribute('disabled');
  pauseBt.removeAttribute('disabled');

  if (animationRunners.length) {
    playDemo();
    return;
  }

  const root = stateContainer;
  const walker = Theseus.createWalker(
    root,
    walkerFilter,
  );

  let i = 0;
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const animationDelay = animationDuration * i;
    animationRunners.push(check(node, animationDelay));
    const transition = compute(node, animationDelay);
    !!transition && animationRunners.push(transition);
    ++i;
  }
  
  
  animationRunners = animationRunners.flat()
    .map(createTransition => createTransition());

  await Promise.all(
    animationRunners
      .map(transition => transition.play())
  );
  animationRunners = [];

  endDemo();
}

function endDemo() {
  initBt.removeAttribute('disabled');
  pauseBt.setAttribute('disabled', '');
  runBt.setAttribute('disabled', '');
}


function check(node, animationDelay) {
  return () => new Transition(() => node.classList.add('checked'), 0, animationDelay);
}

function compute(node, animationDelay) {

  if (node.classList.contains('remove-self')) {
    return remove(node, animationDelay);
  }
  
  if (node.classList.contains('remove-children')) {
    const runners = [...node.children].map(child => {
      return remove(child, animationDelay);
    });
    return runners;
  }

  if (node.classList.contains('move-backward')) {
    return moveBackward(node, animationDelay);
  }

  if (node.classList.contains('move-forward')) {
    return moveForward(node, animationDelay);
  }
}

function remove(node, animationDelay) {
  const placeholder = new TargetPlaceholder(node);
  garbageContainer.append(placeholder);

  return translateNode(node, animationDelay, placeholder);
}

function moveForward(node, animationDelay) {
  const placeholder = new TargetPlaceholder(node);
  const nextSibling = node.nextElementSibling;
  nextSibling.replaceWith(nextSibling, placeholder);

  return translateNode(node, animationDelay, placeholder);
}

function moveBackward(node, animationDelay) {
  const placeholder = new TargetPlaceholder(node);
  const previousSibling = node.previousElementSibling;
  previousSibling.replaceWith(placeholder, previousSibling);

  return translateNode(node, animationDelay, placeholder);
}

function translateNode(node, animationDelay, placeholder) {
  node.replaceWith();
  
  return () => new Transition(
      translate(node, placeholder),
      animationDuration,
      animationDelay,
    );
}
