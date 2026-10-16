const ProperSkipList = require('proper-skip-list');
const LinkedList = require('linked-list');

// These properties describe the live state of a partially filled order; they are
// computed by the order book itself. Accepting them from an untrusted order
// submission would let the sender bypass whatever validation the host application
// performed on the size and value properties, so they are only honoured when an
// order is added with the restore option, which is reserved for rehydrating a
// trusted snapshot.
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
  }

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
          `The order with id ${order.id} had a ${propertyName} property; it is computed by the order book and is only accepted when the order is added with the restore option`
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
    if (!restore) {
      this._assertNoOrderStateFields(sourceAsk);
    }
    this._assertCapacity(sourceAsk);

    // The order book stores its own copy of the order; a reference kept by the
    // caller must not be able to mutate committed book state afterwards.
    let ask = {...sourceAsk};
    let size = this._toBigIntAmount(ask.size, 'size', ask.id, false);
    if (ask.type === 'limit') {
      ask.price = this._normalizePrice(ask.price, ask.id);
    }
    if (ask.sizeRemaining == null) {
      ask.sizeRemaining = size;
    } else {
      ask.sizeRemaining = this._toBigIntAmount(ask.sizeRemaining, 'sizeRemaining', ask.id, false);
    }
    if (ask.lastSizeTaken == null) {
      ask.lastSizeTaken = 0n;
    } else {
      ask.lastSizeTaken = this._toBigIntAmount(ask.lastSizeTaken, 'lastSizeTaken', ask.id, true);
    }
    if (ask.lastValueTaken == null) {
      ask.lastValueTaken = 0n;
    } else {
      ask.lastValueTaken = this._toBigIntAmount(ask.lastValueTaken, 'lastValueTaken', ask.id, true);
    }

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
      // Set once the taker can no longer reach another maker. Anything still left on
      // the taker at that point cannot be traded, so it must not rest in the order
      // book, but it is kept on the order rather than zeroed so that the host
      // application can see how much to return to the sender.
      let takerIsDone = false;
      // Price levels are emptied in contiguous runs, so they can be dropped with a
      // single range delete per run. A maker which has to be skipped keeps its own
      // level alive and interrupts the current run.
      let deleteRanges = [];
      let deleteRangeMin;
      let deleteRangeMax;
      for (let [currentBidPrice, priceOrderLinkedList] of iterator) {
        if (
          (ask.type === 'limit' && ask.price > currentBidPrice) ||
          takerIsDone ||
          ask.sizeRemaining <= 0n
        ) {
          break;
        }
        let currentItem = priceOrderLinkedList.head;
        while (currentItem) {
          let nextItem = currentItem.next;
          let currentBid = currentItem.order;
          if (takerIsDone || ask.sizeRemaining <= 0n) {
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
              ask.sizeRemaining -= currentBid.lastSizeTaken;
            }
            // This maker's remaining value is worth more than the taker's remaining
            // size, so no further maker can be reached. Any size which was too small
            // to take is not traded and does not rest in the order book; see
            // minPartialTakeValue.
            takerIsDone = true;
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
      if (ask.type === 'limit' && !takerIsDone && ask.sizeRemaining > 0n) {
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
    if (!restore) {
      this._assertNoOrderStateFields(sourceBid);
    }
    this._assertCapacity(sourceBid);

    // The order book stores its own copy of the order; a reference kept by the
    // caller must not be able to mutate committed book state afterwards.
    let bid = {...sourceBid};
    let value = this._toBigIntAmount(bid.value, 'value', bid.id, false);
    if (bid.type === 'limit') {
      bid.price = this._normalizePrice(bid.price, bid.id);
    }
    if (bid.valueRemaining == null) {
      bid.valueRemaining = value;
    } else {
      bid.valueRemaining = this._toBigIntAmount(bid.valueRemaining, 'valueRemaining', bid.id, false);
    }
    if (bid.lastSizeTaken == null) {
      bid.lastSizeTaken = 0n;
    } else {
      bid.lastSizeTaken = this._toBigIntAmount(bid.lastSizeTaken, 'lastSizeTaken', bid.id, true);
    }
    if (bid.lastValueTaken == null) {
      bid.lastValueTaken = 0n;
    } else {
      bid.lastValueTaken = this._toBigIntAmount(bid.lastValueTaken, 'lastValueTaken', bid.id, true);
    }

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
      // Set once the taker can no longer reach another maker. Anything still left on
      // the taker at that point cannot be traded, so it must not rest in the order
      // book, but it is kept on the order rather than zeroed so that the host
      // application can see how much to return to the sender.
      let takerIsDone = false;
      // Price levels are emptied in contiguous runs, so they can be dropped with a
      // single range delete per run. A maker which has to be skipped keeps its own
      // level alive and interrupts the current run.
      let deleteRanges = [];
      let deleteRangeMin;
      let deleteRangeMax;
      for (let [currentAskPrice, priceOrderLinkedList] of iterator) {
        if (
          (bid.type === 'limit' && bid.price < currentAskPrice) ||
          takerIsDone ||
          bid.valueRemaining <= 0n
        ) {
          break;
        }
        let currentItem = priceOrderLinkedList.head;
        while (currentItem) {
          let nextItem = currentItem.next;
          let currentAsk = currentItem.order;
          if (takerIsDone || bid.valueRemaining <= 0n) {
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
              bid.valueRemaining -= currentAsk.lastValueTaken;
            }
            // This maker has more size than the taker's remaining value can buy, so
            // no further maker can be reached. Any value which was too small to take
            // is not traded and does not rest in the order book; see
            // minPartialTakeSize.
            takerIsDone = true;
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
      if (bid.type === 'limit' && !takerIsDone && bid.valueRemaining > 0n) {
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
