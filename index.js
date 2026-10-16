const ProperSkipList = require('proper-skip-list');
const LinkedList = require('linked-list');

// These properties describe the live state of a partially filled order; they are
// computed by the order book itself. They are accepted on input so that a snapshot
// can be rehydrated, but a host application which passes untrusted order objects
// straight to add() should enable the strictOrderState option; otherwise a sender
// could use them to bypass validation of the size or value property.
const ORDER_STATE_FIELDS = ['sizeRemaining', 'valueRemaining', 'lastSizeTaken', 'lastValueTaken'];

class BigOrderBook {
  constructor(options) {
    this.options = options || {};
    this.orderItemMap = new Map();
    this.askList = new ProperSkipList({updateLength: false});
    this.bidList = new ProperSkipList({updateLength: false});
    this.askCount = 0;
    this.bidCount = 0;
    this.minPartialTakeValue = BigInt(this.options.minPartialTakeValue || 0);
    this.minPartialTakeSize = BigInt(this.options.minPartialTakeSize || 0);
    this.priceDecimalPrecision = this.options.priceDecimalPrecision == null ? 4 : this.options.priceDecimalPrecision;
    this.pricePrecisionFactor = 10 ** this.priceDecimalPrecision;
    if (!Number.isSafeInteger(this.pricePrecisionFactor) || this.pricePrecisionFactor < 1) {
      throw new Error(
        `The priceDecimalPrecision option of ${this.priceDecimalPrecision} was not valid; it must be an integer between 0 and 15`
      );
    }
    this.maxOrderCount = this.options.maxOrderCount == null ? Infinity : this.options.maxOrderCount;
    this.strictOrderState = !!this.options.strictOrderState;
  }

  // The order book takes ownership of the order object: it writes the computed
  // sizeRemaining, valueRemaining, lastSizeTaken and lastValueTaken properties onto
  // it, normalizes its price and then holds that same object, so the caller can
  // track an order by keeping its own reference. The caller must not modify the
  // object afterwards; the orders handed back by get, remove and the iterators are
  // copies precisely so that reading the book cannot corrupt it.
  add(order, options) {
    if (order == null) {
      throw new Error('The order to add was null or undefined');
    }
    if (order.side !== 'ask' && order.side !== 'bid') {
      throw new Error(
        `The order ${order.id} did not have a valid side property; it should be ask or bid`
      );
    }
    // An unrecognized type used to be treated as a market order, so a typo in the
    // type turned a price-limited order into one which swept the whole book.
    if (order.type !== 'limit' && order.type !== 'market') {
      throw new Error(
        `The order ${order.id} did not have a valid type property; it should be limit or market`
      );
    }
    let restore = !!(options && options.restore);
    if (order.side === 'ask') {
      return this._addAsk(order, restore);
    }
    return this._addBid(order, restore);
  }

  has(orderId) {
    return this.orderItemMap.has(orderId);
  }

  get(orderId) {
    let item = this.orderItemMap.get(orderId);
    if (!item) {
      return undefined;
    }
    return {...item.order};
  }

  findBids(price) {
    let result = this.bidList.findEntries(price);
    return {
      asc: this._getSimpleOrderIterator(result.asc),
      desc: this._getSimpleOrderIterator(result.desc),
    }
  }

  findAsks(price) {
    let result = this.askList.findEntries(price);
    return {
      asc: this._getSimpleOrderIterator(result.asc),
      desc: this._getSimpleOrderIterator(result.desc),
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

    if (order.side === 'ask') {
      this.askCount--;
      if (priceOrderLinkedList.size <= 0) {
        this.askList.delete(order.price);
      } else {
        priceOrderLinkedList.sizeRemaining -= order.sizeRemaining;
      }
    } else {
      this.bidCount--;
      if (priceOrderLinkedList.size <= 0) {
        this.bidList.delete(order.price);
      } else {
        priceOrderLinkedList.valueRemaining -= order.valueRemaining;
      }
    }
    this.orderItemMap.delete(orderId);
    return {...order};
  }

  getMaxAsk() {
    let priceOrderMap = this.askList.maxValue();
    return priceOrderMap && priceOrderMap.head ? {...priceOrderMap.head.order} : undefined;
  }

  getMinAsk() {
    let priceOrderMap = this.askList.minValue();
    return priceOrderMap && priceOrderMap.head ? {...priceOrderMap.head.order} : undefined;
  }

  getMaxBid() {
    let priceOrderMap = this.bidList.maxValue();
    return priceOrderMap && priceOrderMap.head ? {...priceOrderMap.head.order} : undefined;
  }

  getMinBid() {
    let priceOrderMap = this.bidList.minValue();
    return priceOrderMap && priceOrderMap.head ? {...priceOrderMap.head.order} : undefined;
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

  getAskLevelIteratorFromMin() {
    return this._getAskPriceLevelIterator(this.askList.findEntriesFromMin());
  }

  getAskLevelIteratorFromMax() {
    return this._getAskPriceLevelIterator(this.askList.findEntriesFromMax());
  }

  getBidLevelIteratorFromMin() {
    return this._getBidPriceLevelIterator(this.bidList.findEntriesFromMin());
  }

  getBidLevelIteratorFromMax() {
    return this._getBidPriceLevelIterator(this.bidList.findEntriesFromMax());
  }

  clear() {
    this.askList.clear();
    this.bidList.clear();
    this.orderItemMap.clear();
    this.askCount = 0;
    this.bidCount = 0;
  }

  _convertSizeToValue(size, price) {
    return size * BigInt(Math.round(price * this.pricePrecisionFactor)) / BigInt(this.pricePrecisionFactor);
  }

  _convertValueToSize(value, price) {
    let priceUnits = BigInt(Math.round(price * this.pricePrecisionFactor));
    if (priceUnits <= 0n) {
      throw new Error(
        `Cannot convert a value to a size at a price of ${price} because the price is not greater than 0`
      );
    }
    return value * BigInt(this.pricePrecisionFactor) / priceUnits;
  }

  // Rounds the price to the configured precision and only then checks that it is
  // positive. Checking before rounding let through prices which were above 0 but
  // below half of the smallest representable increment; those were stored as a
  // price of 0, which cannot be converted between size and value. It also rejects
  // NaN and Infinity, which both passed a bare price <= 0 check.
  _normalizePrice(price, orderId) {
    let priceNumber = Number(price);
    if (!Number.isFinite(priceNumber)) {
      throw new Error(
        `The limit order with id ${orderId} did not have a valid price property; it must be a finite number`
      );
    }
    let priceUnits = Math.round(priceNumber * this.pricePrecisionFactor);
    if (!Number.isSafeInteger(priceUnits)) {
      throw new Error(
        `The limit order with id ${orderId} had a price property of ${priceNumber} which was too large to represent at a priceDecimalPrecision of ${this.priceDecimalPrecision}`
      );
    }
    if (priceUnits <= 0) {
      throw new Error(
        `The limit order with id ${orderId} had a price property of ${priceNumber} which was not greater than 0 at a priceDecimalPrecision of ${this.priceDecimalPrecision}`
      );
    }
    return priceUnits / this.pricePrecisionFactor;
  }

  // Amounts are expected to be integers. A negative amount used to be accepted and
  // made every subtraction in the matching loop run backwards, which allowed a
  // taker to end up with more size or value than it started with.
  _toBigIntAmount(amount, propertyName, orderId, allowZero) {
    if (typeof amount === 'number' && !Number.isSafeInteger(amount)) {
      throw new Error(
        `The order with id ${orderId} had a ${propertyName} property of ${amount} which was not a safe integer; large amounts should be provided as a BigInt or as a string`
      );
    }
    let bigIntAmount;
    try {
      bigIntAmount = BigInt(amount);
    } catch (error) {
      throw new Error(
        `The order with id ${orderId} had a ${propertyName} property which could not be converted to a BigInt; it must be an integer`
      );
    }
    if (allowZero ? bigIntAmount < 0n : bigIntAmount <= 0n) {
      throw new Error(
        `The order with id ${orderId} had a ${propertyName} property of ${bigIntAmount} which was not ${allowZero ? 'greater than or equal to' : 'greater than'} 0`
      );
    }
    return bigIntAmount;
  }

  _assertNoOrderStateFields(order) {
    for (let propertyName of ORDER_STATE_FIELDS) {
      if (order[propertyName] !== undefined) {
        throw new Error(
          `The order with id ${order.id} had a ${propertyName} property; it is computed by the order book and the strictOrderState option only accepts it when the order is added with the restore option`
        );
      }
    }
  }

  // Market orders never rest in the order book so they cannot grow it.
  _assertCapacity(order) {
    if (order.type === 'limit' && this.askCount + this.bidCount >= this.maxOrderCount) {
      throw new Error(
        `The limit order with id ${order.id} could not be added because the order book already holds the maximum of ${this.maxOrderCount} orders`
      );
    }
  }

  _addAsk(sourceAsk, restore) {
    if (sourceAsk.value != null) {
      throw new Error(
        `The ask order with id ${sourceAsk.id} should not have a value property; it should have a size property instead`
      );
    }
    if (sourceAsk.size == null) {
      throw new Error(
        `The ask order with id ${sourceAsk.id} did not have a valid size property`
      );
    }
    if (this.has(sourceAsk.id)) {
      throw new Error(
        `The ask order with id ${sourceAsk.id} is already in the order book`
      );
    }
    if (this.strictOrderState && !restore) {
      this._assertNoOrderStateFields(sourceAsk);
    }
    this._assertCapacity(sourceAsk);

    // Everything is validated before anything is written, so a rejected order
    // leaves the caller's object exactly as it was.
    let size = this._toBigIntAmount(sourceAsk.size, 'size', sourceAsk.id, false);
    let price = sourceAsk.type === 'limit' ?
      this._normalizePrice(sourceAsk.price, sourceAsk.id) : sourceAsk.price;
    let sizeRemaining = sourceAsk.sizeRemaining == null ?
      size : this._toBigIntAmount(sourceAsk.sizeRemaining, 'sizeRemaining', sourceAsk.id, false);
    let lastSizeTaken = sourceAsk.lastSizeTaken == null ?
      0n : this._toBigIntAmount(sourceAsk.lastSizeTaken, 'lastSizeTaken', sourceAsk.id, true);
    let lastValueTaken = sourceAsk.lastValueTaken == null ?
      0n : this._toBigIntAmount(sourceAsk.lastValueTaken, 'lastValueTaken', sourceAsk.id, true);

    let ask = sourceAsk;
    if (ask.type === 'limit') {
      ask.price = price;
    }
    ask.sizeRemaining = sizeRemaining;
    ask.lastSizeTaken = lastSizeTaken;
    ask.lastValueTaken = lastValueTaken;

    let makers = [];
    let takeSize = 0n;
    let takeValue = 0n;
    let highestBid = this.getMaxBid();
    if (
      ask.type === 'limit' &&
      (!highestBid || ask.price > highestBid.price)
    ) {
      this._insertAsk(ask);
    } else {
      let iterator = this.bidList.findEntriesFromMax();
      // Price levels are emptied in contiguous runs, so they can be dropped with a
      // single range delete per run. A maker which has to be skipped keeps its own
      // level alive and interrupts the current run.
      let deleteRanges = [];
      let deleteRangeMin;
      let deleteRangeMax;
      for (let [currentBidPrice, priceOrderLinkedList] of iterator) {
        if (
          (ask.type === 'limit' && ask.price > currentBidPrice) ||
          ask.sizeRemaining <= 0n
        ) {
          break;
        }
        let currentItem = priceOrderLinkedList.head;
        while (currentItem) {
          let nextItem = currentItem.next;
          let currentBid = currentItem.order;
          if (ask.sizeRemaining <= 0n) {
            break;
          }
          let askValueRemaining = this._convertSizeToValue(ask.sizeRemaining, currentBid.price);
          if (askValueRemaining >= currentBid.valueRemaining) {
            let currentBidSizeRemaining = this._convertValueToSize(currentBid.valueRemaining, currentBid.price);
            if (currentBidSizeRemaining <= 0n) {
              // The value left on this maker is too small to buy a whole unit of
              // size at the maker's own price. Filling it would hand the taker
              // value in exchange for no size at all, so the maker is skipped and
              // left in the order book for its sender to cancel.
              if (deleteRangeMin != null) {
                deleteRanges.push([deleteRangeMin, deleteRangeMax]);
                deleteRangeMin = undefined;
                deleteRangeMax = undefined;
              }
              currentItem = nextItem;
              continue;
            }
            ask.sizeRemaining -= currentBidSizeRemaining;
            currentBid.lastSizeTaken = currentBidSizeRemaining;
            currentBid.lastValueTaken = currentBid.valueRemaining;
            currentBid.valueRemaining = 0n;
            if (currentItem.list.size <= 1) {
              if (deleteRangeMax == null) {
                deleteRangeMax = currentBidPrice;
              }
              deleteRangeMin = currentBidPrice;
            }
            currentItem.detach();
            this.bidCount--;
            this.orderItemMap.delete(currentBid.id);
            takeSize += currentBid.lastSizeTaken;
            takeValue += currentBid.lastValueTaken;
            priceOrderLinkedList.valueRemaining -= currentBid.lastValueTaken;
            makers.push(currentBid);
          } else {
            // Both legs of the fill describe the same trade: the taker sells all
            // of its remaining size and the maker pays exactly what that size is
            // worth at the maker's price. Reporting a take size which was converted
            // back from the value instead used to make the two legs disagree, and a
            // value of 0 used to let the maker take the size for nothing.
            // Only take a portion from the maker if the remaining value is greater than the minimum take value.
            if (askValueRemaining > 0n && askValueRemaining >= this.minPartialTakeValue) {
              currentBid.lastSizeTaken = ask.sizeRemaining;
              currentBid.lastValueTaken = askValueRemaining;
              currentBid.valueRemaining -= askValueRemaining;
              takeSize += currentBid.lastSizeTaken;
              takeValue += currentBid.lastValueTaken;
              priceOrderLinkedList.valueRemaining -= currentBid.lastValueTaken;
              makers.push(currentBid);
            }
            // This maker's remaining value is worth more than the taker's remaining
            // size, so no further maker can be reached. Any size which could not be
            // taken is given up rather than left to rest as a dust order; the host
            // application can see how much from size minus takeSize. See
            // minPartialTakeValue.
            ask.sizeRemaining = 0n;
          }
          currentItem = nextItem;
        }
      }
      if (deleteRangeMin != null) {
        deleteRanges.push([deleteRangeMin, deleteRangeMax]);
      }
      for (let [rangeMin, rangeMax] of deleteRanges) {
        this.bidList.deleteRange(rangeMin, rangeMax, true, true);
      }
      if (ask.type === 'limit' && ask.sizeRemaining > 0n) {
        this._insertAsk(ask);
      }
    }
    return {
      taker: {...ask},
      makers: makers.map(maker => ({...maker})),
      takeSize,
      takeValue
    };
  }

  _insertAsk(order) {
    let priceOrderLinkedList = this.askList.find(order.price);
    if (!priceOrderLinkedList) {
      priceOrderLinkedList = new LinkedList();
      this.askList.upsert(order.price, priceOrderLinkedList);
      priceOrderLinkedList.sizeRemaining = 0n;
    }
    let newItem = new LinkedList.Item();
    newItem.order = order;
    priceOrderLinkedList.append(newItem);
    priceOrderLinkedList.sizeRemaining += order.sizeRemaining;
    this.orderItemMap.set(order.id, newItem);
    this.askCount++;
  }

  _addBid(sourceBid, restore) {
    if (sourceBid.size != null) {
      throw new Error(
        `The bid order with id ${sourceBid.id} should not have a size property; it should have a value property instead`
      );
    }
    if (sourceBid.value == null) {
      throw new Error(
        `The bid order with id ${sourceBid.id} did not have a valid value property`
      );
    }
    if (this.has(sourceBid.id)) {
      throw new Error(
        `The bid order with id ${sourceBid.id} is already in the order book`
      );
    }
    if (this.strictOrderState && !restore) {
      this._assertNoOrderStateFields(sourceBid);
    }
    this._assertCapacity(sourceBid);

    // Everything is validated before anything is written, so a rejected order
    // leaves the caller's object exactly as it was.
    let value = this._toBigIntAmount(sourceBid.value, 'value', sourceBid.id, false);
    let price = sourceBid.type === 'limit' ?
      this._normalizePrice(sourceBid.price, sourceBid.id) : sourceBid.price;
    let valueRemaining = sourceBid.valueRemaining == null ?
      value : this._toBigIntAmount(sourceBid.valueRemaining, 'valueRemaining', sourceBid.id, false);
    let lastSizeTaken = sourceBid.lastSizeTaken == null ?
      0n : this._toBigIntAmount(sourceBid.lastSizeTaken, 'lastSizeTaken', sourceBid.id, true);
    let lastValueTaken = sourceBid.lastValueTaken == null ?
      0n : this._toBigIntAmount(sourceBid.lastValueTaken, 'lastValueTaken', sourceBid.id, true);

    let bid = sourceBid;
    if (bid.type === 'limit') {
      bid.price = price;
    }
    bid.valueRemaining = valueRemaining;
    bid.lastSizeTaken = lastSizeTaken;
    bid.lastValueTaken = lastValueTaken;

    let makers = [];
    let takeSize = 0n;
    let takeValue = 0n;
    let lowestAsk = this.getMinAsk();
    if (
      bid.type === 'limit' &&
      (!lowestAsk || bid.price < lowestAsk.price)
    ) {
      this._insertBid(bid);
    } else {
      let iterator = this.askList.findEntriesFromMin();
      // Price levels are emptied in contiguous runs, so they can be dropped with a
      // single range delete per run. A maker which has to be skipped keeps its own
      // level alive and interrupts the current run.
      let deleteRanges = [];
      let deleteRangeMin;
      let deleteRangeMax;
      for (let [currentAskPrice, priceOrderLinkedList] of iterator) {
        if (
          (bid.type === 'limit' && bid.price < currentAskPrice) ||
          bid.valueRemaining <= 0n
        ) {
          break;
        }
        let currentItem = priceOrderLinkedList.head;
        while (currentItem) {
          let nextItem = currentItem.next;
          let currentAsk = currentItem.order;
          if (bid.valueRemaining <= 0n) {
            break;
          }
          let bidSizeRemaining = this._convertValueToSize(bid.valueRemaining, currentAsk.price);
          if (bidSizeRemaining >= currentAsk.sizeRemaining) {
            let currentAskValueRemaining = this._convertSizeToValue(currentAsk.sizeRemaining, currentAsk.price);
            if (currentAskValueRemaining <= 0n) {
              // The size left on this maker is worth less than one unit of value
              // at the maker's own price. Filling it would hand the taker size in
              // exchange for no value at all, so the maker is skipped and left in
              // the order book for its sender to cancel.
              if (deleteRangeMin != null) {
                deleteRanges.push([deleteRangeMin, deleteRangeMax]);
                deleteRangeMin = undefined;
                deleteRangeMax = undefined;
              }
              currentItem = nextItem;
              continue;
            }
            bid.valueRemaining -= currentAskValueRemaining;
            currentAsk.lastSizeTaken = currentAsk.sizeRemaining;
            currentAsk.lastValueTaken = currentAskValueRemaining;
            currentAsk.sizeRemaining = 0n;
            if (currentItem.list.size <= 1) {
              if (deleteRangeMin == null) {
                deleteRangeMin = currentAskPrice;
              }
              deleteRangeMax = currentAskPrice;
            }
            currentItem.detach();
            this.askCount--;
            this.orderItemMap.delete(currentAsk.id);
            takeSize += currentAsk.lastSizeTaken;
            takeValue += currentAsk.lastValueTaken;
            priceOrderLinkedList.sizeRemaining -= currentAsk.lastSizeTaken;
            makers.push(currentAsk);
          } else {
            // Both legs of the fill describe the same trade: the maker gives up the
            // size which the taker's remaining value can buy and is credited exactly
            // what that size is worth. Crediting the maker the taker's whole
            // remaining value instead used to overpay it by up to one unit of price
            // per fill, and a size of 0 used to pay it for nothing at all.
            let takenValue = this._convertSizeToValue(bidSizeRemaining, currentAsk.price);
            // Only take a portion from the maker if the remaining size is greater than the minimum take size.
            if (bidSizeRemaining > 0n && takenValue > 0n && bidSizeRemaining >= this.minPartialTakeSize) {
              currentAsk.lastSizeTaken = bidSizeRemaining;
              currentAsk.lastValueTaken = takenValue;
              currentAsk.sizeRemaining -= bidSizeRemaining;
              takeSize += currentAsk.lastSizeTaken;
              takeValue += currentAsk.lastValueTaken;
              priceOrderLinkedList.sizeRemaining -= currentAsk.lastSizeTaken;
              makers.push(currentAsk);
            }
            // This maker has more size than the taker's remaining value can buy, so
            // no further maker can be reached. Any value which could not be taken is
            // given up rather than left to rest as a dust order; the host application
            // can see how much from value minus takeValue. See minPartialTakeSize.
            bid.valueRemaining = 0n;
          }
          currentItem = nextItem;
        }
      }
      if (deleteRangeMin != null) {
        deleteRanges.push([deleteRangeMin, deleteRangeMax]);
      }
      for (let [rangeMin, rangeMax] of deleteRanges) {
        this.askList.deleteRange(rangeMin, rangeMax, true, true);
      }
      if (bid.type === 'limit' && bid.valueRemaining > 0n) {
        this._insertBid(bid);
      }
    }
    return {
      taker: {...bid},
      makers: makers.map(maker => ({...maker})),
      takeSize,
      takeValue
    };
  }

  _insertBid(order) {
    let priceOrderLinkedList = this.bidList.find(order.price);
    if (!priceOrderLinkedList) {
      priceOrderLinkedList = new LinkedList();
      this.bidList.upsert(order.price, priceOrderLinkedList);
      priceOrderLinkedList.valueRemaining = 0n;
    }
    let newItem = new LinkedList.Item();
    newItem.order = order;
    priceOrderLinkedList.append(newItem);
    priceOrderLinkedList.valueRemaining += order.valueRemaining;
    this.orderItemMap.set(order.id, newItem);
    this.bidCount++;
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
          value: {...currentOrder},
          done: false
        };
      },
      [Symbol.iterator]: function () { return this; }
    };
  }

  _getAskPriceLevelIterator(orderListIterator) {
    return {
      next: function () {
        let {value, done} = orderListIterator.next();
        let [price, priceOrderLinkedList] = value;
        let result;
        if (priceOrderLinkedList == null) {
          result = undefined;
        } else {
          result = {
            price,
            sizeRemaining: priceOrderLinkedList.sizeRemaining
          };
        }
        return {
          value: result,
          done
        };
      },
      [Symbol.iterator]: function () { return this; }
    };
  }

  _getBidPriceLevelIterator(orderListIterator) {
    return {
      next: function () {
        let {value, done} = orderListIterator.next();
        let [price, priceOrderLinkedList] = value;
        let result;
        if (priceOrderLinkedList == null) {
          result = undefined;
        } else {
          result = {
            price,
            valueRemaining: priceOrderLinkedList.valueRemaining
          };
        }
        return {
          value: result,
          done
        };
      },
      [Symbol.iterator]: function () { return this; }
    };
  }
}

module.exports = BigOrderBook;
