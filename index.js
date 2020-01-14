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
    ask.sizeRemaining = ask.size;

    let result = {
      taker: ask,
      makers: [],
      takeSize: 0,
      takeValue: 0
    };
    let highestBid = this.peekBids();
    if (ask.price > highestBid.price) {
      this._insertAsk(ask);
    } else {
      let iterator = this.bidList.findEntriesFromMax();
      for (let priceOrderLinkedList of iterator) {
        let currentItem = priceOrderLinkedList.head;
        while (currentItem) {
          let currentBid = currentItem.order;
          if (ask.price > currentBid.price || ask.sizeRemaining <= 0) {
            break;
          }
          let askValueRemaining = ask.sizeRemaining * currentBid.price;
          if (askValueRemaining >= currentBid.valueRemaining) {
            let currentBidSizeRemaining = currentBid.valueRemaining / currentBid.price;
            ask.sizeRemaining -= currentBidSizeRemaining;
            currentBid.lastValueTaken = currentBid.valueRemaining;
            currentBid.valueRemaining = 0;
          } else {
            ask.sizeRemaining = 0;
            currentBid.lastValueTaken = askValueRemaining;
            currentBid.valueRemaining -= askValueRemaining;
          }
          result.makers.push(currentBid);
          result.takeValue += currentBid.lastValueTaken;
          currentItem = currentItem.next;
        }
      }
    }
    return result;
  }

  _addBid(bid) {
    bid.valueRemaining = bid.value;

    let result = {
      taker: bid,
      makers: [],
      takeSize: 0,
      takeValue: 0
    };
    let lowestAsk = this.peekAsks();
    if (bid.price < lowestAsk.price) {
      this._insertBid(bid);
    } else {
      let iterator = this.askList.findEntriesFromMin();
      for (let priceOrderLinkedList of iterator) {
        let currentItem = priceOrderLinkedList.head;
        while (currentItem) {
          let currentAsk = currentItem.order;
          if (bid.price < currentAsk.price || bid.valueRemaining <= 0) {
            break;
          }
          let bidSizeRemaining = bid.valueRemaining / currentAsk.price;
          if (bidSizeRemaining >= currentAsk.sizeRemaining) {
            let currentAskValueRemaining = currentAsk.sizeRemaining * currentAsk.price;
            bid.valueRemaining -= currentAskValueRemaining;
            currentAsk.lastSizeTaken = currentAsk.sizeRemaining;
            currentAsk.sizeRemaining = 0;
          } else {
            bid.valueRemaining = 0;
            currentAsk.lastSizeTaken = bidSizeRemaining;
            currentAsk.sizeRemaining -= bidSizeRemaining;
          }
          result.makers.push(currentAsk);
          result.takeSize += currentAsk.lastSizeTaken;
          currentItem = currentItem.next;
        }
      }
    }
    return result;
  }

  _insertAsk(order) {
    if (!priceOrderLinkedList) {
      priceOrderLinkedList = new LinkedList();
      this.askList.upsert(order.price, priceOrderLinkedList);
    }
    order.sizeRemaining = order.size;
    order.lastSizeTaken = 0;
    let newItem = new LinkedList.Item();
    newItem.order = order;
    priceOrderLinkedList.append(newItem);
    this.orderItemMap.set(order.id, newItem);
  }

  _insertBid(order) {
    if (!priceOrderLinkedList) {
      priceOrderLinkedList = new LinkedList();
      this.bidList.upsert(order.price, priceOrderLinkedList);
    }
    order.valueRemaining = order.value;
    order.lastValueTaken = 0;
    let newItem = new LinkedList.Item();
    newItem.order = order;
    priceOrderLinkedList.append(newItem);
    this.orderItemMap.set(order.id, newItem);
  }

  add(order) {
    order = {...order};
    if (order.side === 'ask') {
      this._addAsk(order);
    } elses {
      this._addBid(order);
    }
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
    return minPriceOrderMap.head ? minPriceOrderMap.head.order : undefined;
  }

  peekBids() {
    let maxPriceOrderMap = this.askList.maxValue();
    return maxPriceOrderMap.head ? maxPriceOrderMap.head.order : undefined;
  }

  clear() {
    this.askList.clear();
    this.bidList.clear();
    this.orderItemMap.clear();
  }

  getSnapshot() {

  }

  setSnapshot(snapshot) {

  }
}
