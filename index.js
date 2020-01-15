const ProperSkipList = require('proper-skip-list');
const LinkedList = require('linked-list');

class ProperOrderBook {

  constructor() {
    this.orderItemMap = new Map();
    this.askList = new ProperSkipList();
    this.bidList = new ProperSkipList();
  }

  add(order) {
    if (order.side !== 'ask' && order.side !== 'bid') {
      throw new Error(
        `The order ${order.id} did not have a valid side property; it should be ask or bid`
      );
    }
    if (order.side === 'ask') {
      return this._addAsk(order);
    }
    return this._addBid(order);
  }

  has(orderId) {
    return this.orderItemMap.has(orderId);
  }

  remove(orderId) {
    let orderItem = this.orderItemMap.get(orderId);

    if (!orderItem) {
      return undefined;
    }

    let priceOrderLinkedList = orderItem.list;
    let order = orderItem.order;
    orderItem.detach();

    if (priceOrderLinkedList.size <= 0) {
      if (order.side === 'ask') {
        this.askList.delete(order.price);
      } else {
        this.bidList.delete(order.price);
      }
    }

    this.orderItemMap.delete(orderId);
    return order;
  }

  getMaxAsk() {
    let priceOrderMap = this.askList.maxValue();
    return priceOrderMap && priceOrderMap.head ? priceOrderMap.head.order : undefined;
  }

  getMinAsk() {
    let priceOrderMap = this.askList.minValue();
    return priceOrderMap && priceOrderMap.head ? priceOrderMap.head.order : undefined;
  }

  getMaxBid() {
    let priceOrderMap = this.bidList.maxValue();
    return priceOrderMap && priceOrderMap.head ? priceOrderMap.head.order : undefined;
  }

  getMinBid() {
    let priceOrderMap = this.bidList.minValue();
    return priceOrderMap && priceOrderMap.head ? priceOrderMap.head.order : undefined;
  }

  getAskIteratorFromMin() {
    return this._getSimpleOrderIterator(this.askList.findEntriesFromMin());
  }

  getAskIteratorFromMax() {
    return this._getSimpleOrderIterator(this.askList.findEntriesFromMax());
  }

  getBidIteratorFromMin() {
    return this._getSimpleOrderIterator(this.bidList.findEntriesFromMin());
  }

  getBidIteratorFromMax() {
    return this._getSimpleOrderIterator(this.bidList.findEntriesFromMax());
  }

  clear() {
    this.askList.clear();
    this.bidList.clear();
    this.orderItemMap.clear();
  }

  _addAsk(ask) {
    if (ask.value != null) {
      throw new Error(
        `The ask order with id ${ask.id} should not have a value property; it should have a size property instead`
      );
    }
    if (ask.size == null) {
      throw new Error(
        `The ask order with id ${ask.id} did not have a valid size property`
      );
    }
    if (this.has(ask.id)) {
      throw new Error(
        `The ask order with id ${ask.id} is already in the order book`
      );
    }
    if (ask.sizeRemaining == null) {
      ask.sizeRemaining = ask.size;
    }
    if (ask.lastSizeTaken == null) {
      ask.lastSizeTaken = 0;
    }
    if (ask.lastValueTaken == null) {
      ask.lastValueTaken = 0;
    }

    let result = {
      taker: ask,
      makers: [],
      takeSize: 0,
      takeValue: 0
    };
    let highestBid = this.getMaxBid();
    if (
      ask.type === 'limit' &&
      (!highestBid || ask.price > highestBid.price)
    ) {
      this._insertAsk(ask);
    } else {
      let iterator = this.bidList.findEntriesFromMax();
      for (let [currentBidPrice, priceOrderLinkedList] of iterator) {
        if (
          (ask.type === 'limit' && ask.price > currentBidPrice) ||
          ask.sizeRemaining <= 0
        ) {
          break;
        }
        let currentItem = priceOrderLinkedList.head;
        while (currentItem) {
          let nextItem = currentItem.next;
          let currentBid = currentItem.order;
          if (ask.sizeRemaining <= 0) {
            break;
          }
          let askValueRemaining = ask.sizeRemaining * currentBid.price;
          if (askValueRemaining >= currentBid.valueRemaining) {
            let currentBidSizeRemaining = currentBid.valueRemaining / currentBid.price;
            ask.sizeRemaining -= currentBidSizeRemaining;
            currentBid.lastSizeTaken = currentBidSizeRemaining;
            currentBid.lastValueTaken = currentBid.valueRemaining;
            currentBid.valueRemaining = 0;
            if (currentItem.list.size <= 1) {
              this.bidList.delete(currentBidPrice);
            }
            currentItem.detach();
          } else {
            currentBid.lastSizeTaken = ask.sizeRemaining;
            currentBid.lastValueTaken = askValueRemaining;
            currentBid.valueRemaining -= askValueRemaining;
            ask.sizeRemaining = 0;
          }
          result.makers.push(currentBid);
          result.takeSize += currentBid.lastValueTaken / currentBid.price;
          result.takeValue += currentBid.lastValueTaken;
          currentItem = nextItem;
        }
      }
      if (ask.type === 'limit' && ask.sizeRemaining > 0) {
        this._insertAsk(ask);
      }
    }
    return result;
  }

  _insertAsk(order) {
    let priceOrderLinkedList = this.askList.find(order.price);
    if (!priceOrderLinkedList) {
      priceOrderLinkedList = new LinkedList();
      this.askList.upsert(order.price, priceOrderLinkedList);
    }
    let newItem = new LinkedList.Item();
    newItem.order = order;
    priceOrderLinkedList.append(newItem);
    this.orderItemMap.set(order.id, newItem);
  }

  _addBid(bid) {
    if (bid.size != null) {
      throw new Error(
        `The bid order with id ${bid.id} should not have a size property; it should have a value property instead`
      );
    }
    if (bid.value == null) {
      throw new Error(
        `The bid order with id ${bid.id} did not have a valid value property`
      );
    }
    if (this.has(bid.id)) {
      throw new Error(
        `The bid order with id ${bid.id} is already in the order book`
      );
    }
    if (bid.valueRemaining == null) {
      bid.valueRemaining = bid.value;
    }
    if (bid.lastSizeTaken == null) {
      bid.lastSizeTaken = 0;
    }
    if (bid.lastValueTaken == null) {
      bid.lastValueTaken = 0;
    }

    let result = {
      taker: bid,
      makers: [],
      takeSize: 0,
      takeValue: 0
    };
    let lowestAsk = this.getMinAsk();
    if (
      bid.type === 'limit' &&
      (!lowestAsk || bid.price < lowestAsk.price)
    ) {
      this._insertBid(bid);
    } else {
      let iterator = this.askList.findEntriesFromMin();
      for (let [currentAskPrice, priceOrderLinkedList] of iterator) {
        if (
          (bid.type === 'limit' && bid.price < currentAskPrice) ||
          bid.valueRemaining <= 0
        ) {
          break;
        }
        let currentItem = priceOrderLinkedList.head;
        while (currentItem) {
          let nextItem = currentItem.next;
          let currentAsk = currentItem.order;
          if (bid.valueRemaining <= 0) {
            break;
          }
          let bidSizeRemaining = bid.valueRemaining / currentAsk.price;
          if (bidSizeRemaining >= currentAsk.sizeRemaining) {
            let currentAskValueRemaining = currentAsk.sizeRemaining * currentAsk.price;
            bid.valueRemaining -= currentAskValueRemaining;
            currentAsk.lastSizeTaken = currentAsk.sizeRemaining;
            currentAsk.lastValueTaken = currentAskValueRemaining;
            currentAsk.sizeRemaining = 0;
            if (currentItem.list.size <= 1) {
              this.askList.delete(currentAskPrice);
            }
            currentItem.detach();
          } else {
            currentAsk.lastSizeTaken = bidSizeRemaining;
            currentAsk.lastValueTaken = bid.valueRemaining;
            currentAsk.sizeRemaining -= bidSizeRemaining;
            bid.valueRemaining = 0;
          }
          result.makers.push(currentAsk);
          result.takeSize += currentAsk.lastSizeTaken;
          result.takeValue += currentAsk.lastSizeTaken * currentAsk.price;
          currentItem = nextItem;
        }
      }
      if (bid.type === 'limit' && bid.valueRemaining > 0) {
        this._insertBid(bid);
      }
    }
    return result;
  }

  _insertBid(order) {
    let priceOrderLinkedList = this.bidList.find(order.price);
    if (!priceOrderLinkedList) {
      priceOrderLinkedList = new LinkedList();
      this.bidList.upsert(order.price, priceOrderLinkedList);
    }
    let newItem = new LinkedList.Item();
    newItem.order = order;
    priceOrderLinkedList.append(newItem);
    this.orderItemMap.set(order.id, newItem);
  }

  _getSimpleOrderIterator(orderListIterator) {
    let {value: startValue} = orderListIterator.next();
    let [key, priceOrderLinkedList] = startValue;
    let currentItem = priceOrderLinkedList == null ? undefined : priceOrderLinkedList.head;
    return {
      next: function () {
        if (!currentItem) {
          return {
            value: undefined,
            done: true
          };
        }
        let currentOrder = currentItem.order;
        currentItem = currentItem.next;
        if (!currentItem) {
          let {value, done} = orderListIterator.next();
          let [currentKey, currentPriceOrderLinkedList] = value;
          currentItem = currentPriceOrderLinkedList == null ? undefined : currentPriceOrderLinkedList.head;
        }
        return {
          value: currentOrder,
          done: false
        };
      },
      [Symbol.iterator]: function () { return this; }
    }
  }
}

module.exports = ProperOrderBook;
