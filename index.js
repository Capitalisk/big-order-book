const ProperSkipList = require('proper-skip-list');
const LinkedList = require('linked-list');

class ProperOrderBook {

  constructor() {
    this.orderItemMap = new Map();
    this.askList = new ProperSkipList();
    this.bidList = new ProperSkipList();
  }

  has(orderId) {
    return this.orderItemMap.has(orderId);
  }

  _addAsk(ask) {
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
    let highestBid = this.peekBids();
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
      if (ask.sizeRemaining > 0) {
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
    let lowestAsk = this.peekAsks();
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
      if (bid.valueRemaining > 0) {
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

  add(order) {
    if (order.side === 'ask') {
      return this._addAsk(order);
    }
    return this._addBid(order);
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

  peekAsks() {
    let minPriceOrderMap = this.askList.minValue();
    return minPriceOrderMap && minPriceOrderMap.head ? minPriceOrderMap.head.order : undefined;
  }

  peekBids() {
    let maxPriceOrderMap = this.askList.maxValue();
    return maxPriceOrderMap && maxPriceOrderMap.head ? maxPriceOrderMap.head.order : undefined;
  }

  clear() {
    this.askList.clear();
    this.bidList.clear();
    this.orderItemMap.clear();
  }
}

module.exports = ProperOrderBook;
