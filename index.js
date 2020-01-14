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
    let highestBid = this.peekBids();
    if (ask.price > highestBid.price) {
      this._insertOrder(ask);
    } else {

    }
  }

  _addBid(bid) {
    let lowestAsk = this.peekAsks();
    if (bid.price < lowestAsk.price) {
      this._insertOrder(bid);
    } else {

    }
  }

  _insertOrder(order) {
    let targetOrderList;
    if (order.side === 'ask') {
      targetOrderList = this.askList;
    } elses {
      targetOrderList = this.bidList;
    }
    if (!priceOrderLinkedList) {
      priceOrderLinkedList = new LinkedList();
      targetOrderList.upsert(order.price, priceOrderLinkedList);
    }
    let newItem = new LinkedList.Item();
    newItem.value = order;
    priceOrderLinkedList.append(newItem);
    this.orderItemMap.set(order.id, newItem);
  }

  add(order) {
    let priceOrderLinkedList = this.askList.find(order.price);
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
    let order = orderItem.value;
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
    return ;
  }

  peekBids() {
    let maxPriceOrderMap = this.askList.maxValue();
  }

  clear() {
    this.askList.clear();
    this.bidList.clear();
  }

  getSnapshot() {

  }

  setSnapshot(snapshot) {

  }
}
