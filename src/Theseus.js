
const SHOW_REMOVED_ELEMENT_CHILDREN = 0x1000;
const SHOW_REMOVED_CHILDREN = 0x2000;
//const HIDE_MOVED_ELEMENT_CHILDREN = 0x4000;

export const Theseus = {
  createWalker(root, whatToShow = NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, filter = undefined) {
    return new TheseusWalker(root, whatToShow, filter);
  },
  
  *createIterator(root, whatToShow = NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, filter = undefined) {
    const walker = new TheseusWalker(root, whatToShow, filter);

    while(walker.nextNode()) {
      yield walker.currentNode;
    }

    return;
  },

  NodeFilter: {
    SHOW_REMOVED_ELEMENT_CHILDREN,
    SHOW_REMOVED_CHILDREN,
    //HIDE_MOVED_ELEMENT_CHILDREN,
  }
}


class TheseusWalker {
  #treeWalker = null;
  #previousNode = null;
  #childWalker = null;
  #currentChildren = [];
  #position = null;
  #tests = null;

  get root() {
    return this.#treeWalker?.root;
  }
  get whatToShow() {
    return this.#treeWalker?.whatToShow;
  }
  get filter() {
    return this.#treeWalker?.filter;
  }
  get currentNode() {
    if (this.#childWalker?.currentNode) {
      return this.#childWalker.currentNode;
    }
    return this.#treeWalker.currentNode;
  }

  constructor(root, whatToShow = NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, filter = undefined) {
    this.#treeWalker = this.#createWalker(root, whatToShow, filter);
    this.#tests = {
      must: (constant) => this.whatToShow & constant,
      hasBeenRemoved: (node) => node !== this.root && !node.parentNode,
      hasChildren: (node) => node.children.length,
      hasRemovedChildren: (node) => !node.children.length && !!this.#currentChildren.length,
      hasBeenMoved: (node) => this.#position && !this.#areSamePosition( this.#position, this.#createNodePosition(node)),
      hasMovedBackward: (node) => this.#previousNode.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_PRECEDING,
      hasMovedForward: (node) => this.#previousNode.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING,
    };
  }

  nextNode() {
    const { must, hasBeenRemoved, hasChildren, hasRemovedChildren, hasBeenMoved, hasMovedBackward, hasMovedForward }  = this.#tests;

    if (this.#childWalker) {
      const node = this.#childWalker.nextNode();
      if (node) {
        return node;
      }
      this.#childWalker = null;
      this.#currentChildren = [];
    }

    const currentNode = this.#treeWalker.currentNode;

    if (hasBeenRemoved(currentNode)) {
      this.#treeWalker.currentNode = this.#previousNode;

      if (must(SHOW_REMOVED_ELEMENT_CHILDREN) && hasChildren(currentNode)) {
        return this.#walkThroughChildren(currentNode);
      }
      return this.#goNext();
    }

    if (hasRemovedChildren(currentNode) && must(SHOW_REMOVED_CHILDREN)) {
      return this.#walkThroughRemovedChildren();
    }

    if (hasBeenMoved(currentNode)) {
      if (hasMovedBackward(currentNode)) {
        this.#treeWalker.currentNode = this.#previousNode;
      } else if (hasMovedForward(currentNode)) {
        this.#treeWalker = this.#createWalker(this.root, this.whatToShow, node => node === currentNode ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT);
        this.#treeWalker.currentNode = this.#previousNode;
      }
    }

    // Normal walk
    return this.#goNext();
  }

  #goNext() {
    this.#previousNode =  this.#treeWalker.currentNode;
    const nextNode = this.#treeWalker.nextNode();
    this.#currentChildren = [...(nextNode?.children || [])];
    this.#position = this.#createNodePosition(nextNode);
    return nextNode;
  }

  #walkThroughChildren(childrenRoot) {
    this.#childWalker = new TheseusWalker(childrenRoot, this.whatToShow, this.filter);
    return this.#childWalker.nextNode();
  }

  #walkThroughRemovedChildren() {
    const docFrag = document.createDocumentFragment();
    docFrag.append(...this.#currentChildren);
    return this.#walkThroughChildren(docFrag);
  }

  #createWalker(root, whatToShow = this.whatToShow, filter = this.filter) {
    return document.createTreeWalker(root, whatToShow, this.#createFilterFn(filter));
  }

  #createFilterFn(filter) {
    if (!filter) {
      return this.filter;
    }

    filter = filter.acceptNode || filter;

    if (!this.filter || this.filter === filter) {
      return filter;
    }

    console.log('createFilterFn');

    const previousFilter = this.filter;

    return node => {
      return filter(node) === NodeFilter.FILTER_REJECT
        ? NodeFilter.FILTER_REJECT
        : previousFilter(node)
    }
  }

  #createNodePosition(node) {
    if (!node || !node.parentNode) {
      return null;
    }

    const walker = this.#createWalker(node.parentNode);
    walker.currentNode = node;

    return {
      parentNode: node.parentNode,
      previousSibling: walker.previousSibling(),
    }
  }

  #areSamePosition(position1, position2) {
    return position1.parentNode === position2.parentNode
      && position1.previousSibling === position2.previousSibling
  }
}