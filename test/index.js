const assert = require('assert');
const BigOrderBook = require('../');

describe('BigOrderBook unit tests', async () => {
  let orderBook;
  let result;
  let error;

  beforeEach(async () => {
    orderBook = new BigOrderBook({
      priceDecimalPrecision: 4
    });
  });

  describe('#add', async () => {
    it('should insert non-matching bids and asks into the order book', async () => {
      orderBook.add({
        id: `ask0`,
        type: 'limit',
        price: .5,
        targetChain: 'lsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'ask',
        size: 100
      });

      assert(orderBook.askCount === 1);
      assert(orderBook.bidCount === 0);

      orderBook.add({
        id: `ask1`,
        type: 'limit',
        price: .6,
        targetChain: 'lsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'ask',
        size: 100
      });
      orderBook.add({
        id: `bid0`,
        type: 'limit',
        price: .49,
        targetChain: 'clsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'bid',
        value: 10
      });
      orderBook.add({
        id: `bid1`,
        type: 'limit',
        price: .4,
        targetChain: 'clsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'bid',
        value: 10
      });

      let iterator = orderBook.getAskIteratorFromMin();
      assert(iterator.next().value.id === 'ask0');
      assert(iterator.next().value.id === 'ask1');
      assert(iterator.next().value === undefined);

      iterator = orderBook.getBidIteratorFromMax();
      assert(iterator.next().value.id === 'bid0');
      assert(iterator.next().value.id === 'bid1');
      assert(iterator.next().value === undefined);

      let allAsks = [...orderBook.getAskIteratorFromMin()];
      let allBids = [...orderBook.getBidIteratorFromMin()];
      assert(orderBook.askCount === allAsks.length);
      assert(orderBook.bidCount === allBids.length);
    });

    it('should allow limit orders to get a better price if available', async () => {
      orderBook.add({
        id: `ask0`,
        type: 'limit',
        price: .5,
        targetChain: 'lsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'ask',
        size: 100
      });
      orderBook.add({
        id: `ask1`,
        type: 'limit',
        price: .6,
        targetChain: 'lsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'ask',
        size: 100
      });
      result = orderBook.add({
        id: `bid0`,
        type: 'limit',
        price: .9,
        targetChain: 'clsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'bid',
        value: 40
      });

      assert(result.takeSize === 80n);
      assert(result.takeValue === 40n);
      assert(result.makers.length === 1);
      assert(result.makers[0].lastSizeTaken === 80n);
      assert(result.makers[0].lastValueTaken === 40n);
      assert(result.makers[0].sizeRemaining === 20n);

      let allAsks = [...orderBook.getAskIteratorFromMin()];
      let allBids = [...orderBook.getBidIteratorFromMin()];
      assert(orderBook.askCount === allAsks.length);
      assert(orderBook.bidCount === allBids.length);
    });

    it('should support multiple makers', async () => {
      orderBook.add({
        id: `ask0`,
        type: 'limit',
        price: .5,
        targetChain: 'lsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'ask',
        size: 100
      });
      orderBook.add({
        id: `ask1`,
        type: 'limit',
        price: .6,
        targetChain: 'lsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'ask',
        size: 100
      });
      result = orderBook.add({
        id: `bid0`,
        type: 'limit',
        price: .9,
        targetChain: 'clsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'bid',
        value: 110
      });

      assert(result.takeSize === 200n);
      assert(result.takeValue === 110n);
      assert(result.makers.length === 2);
      assert(result.makers[0].lastSizeTaken === 100n);
      assert(result.makers[0].lastValueTaken === 50n);
      assert(result.makers[0].sizeRemaining === 0n);
      assert(result.makers[1].lastSizeTaken === 100n);
      assert(result.makers[1].lastValueTaken === 60n);
      assert(result.makers[1].sizeRemaining === 0n);

      let allAsks = [...orderBook.getAskIteratorFromMin()];
      let allBids = [...orderBook.getBidIteratorFromMin()];
      assert(orderBook.askCount === allAsks.length);
      assert(orderBook.bidCount === allBids.length);
    });

    it('should add bid limit order to the order book if it is larger than available volume', async () => {
      orderBook.add({
        id: `ask0`,
        type: 'limit',
        price: .5,
        targetChain: 'lsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'ask',
        size: 100
      });
      orderBook.add({
        id: `ask1`,
        type: 'limit',
        price: .6,
        targetChain: 'lsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'ask',
        size: 100
      });
      result = orderBook.add({
        id: `bid0`,
        type: 'limit',
        price: .9,
        targetChain: 'clsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'bid',
        value: 160
      });

      assert(result.takeSize === 200n);
      assert(result.takeValue === 110n);
      assert(result.makers.length === 2);
      assert(result.makers[0].lastSizeTaken === 100n);
      assert(result.makers[0].lastValueTaken === 50n);
      assert(result.makers[0].sizeRemaining === 0n);
      assert(result.makers[1].lastSizeTaken === 100n);
      assert(result.makers[1].lastValueTaken === 60n);
      assert(result.makers[1].sizeRemaining === 0n);

      let iterator = orderBook.getBidIteratorFromMax();
      let bid = iterator.next().value;
      assert(bid.valueRemaining === 50n);
      assert(bid.lastSizeTaken === 0n);
      assert(bid.lastValueTaken === 0n);
      let lastEntry = iterator.next();
      assert(lastEntry.value === undefined);
      assert(lastEntry.done);

      let allAsks = [...orderBook.getAskIteratorFromMin()];
      let allBids = [...orderBook.getBidIteratorFromMin()];
      assert(orderBook.askCount === allAsks.length);
      assert(orderBook.bidCount === allBids.length);
    });

    it('should add ask limit order to the order book if it is larger than available volume', async () => {
      orderBook.add({
        id: `bid0`,
        type: 'limit',
        price: .5,
        targetChain: 'clsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'bid',
        value: 50
      });
      orderBook.add({
        id: `bid1`,
        type: 'limit',
        price: .6,
        targetChain: 'clsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'bid',
        value: 60
      });
      result = orderBook.add({
        id: `ask0`,
        type: 'limit',
        price: .4,
        targetChain: 'lsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'ask',
        size: 250
      });
      assert(result.takeSize === 200n);
      assert(result.takeValue === 110n);
      assert(result.makers.length === 2);
      assert(result.makers[0].lastSizeTaken === 100n);
      assert(result.makers[0].lastValueTaken === 60n);
      assert(result.makers[0].valueRemaining === 0n);
      assert(result.makers[1].lastSizeTaken === 100n);
      assert(result.makers[1].lastValueTaken === 50n);
      assert(result.makers[1].valueRemaining === 0n);

      let iterator = orderBook.getAskIteratorFromMin();
      let ask = iterator.next().value;
      assert(ask.sizeRemaining === 50n);
      assert(ask.lastSizeTaken === 0n);
      assert(ask.lastValueTaken === 0n);
      let lastEntry = iterator.next();
      assert(lastEntry.value === undefined);
      assert(lastEntry.done);

      let allAsks = [...orderBook.getAskIteratorFromMin()];
      let allBids = [...orderBook.getBidIteratorFromMin()];
      assert(orderBook.askCount === allAsks.length);
      assert(orderBook.bidCount === allBids.length);
    });

    it('should throw an error if an ask order is added with missing or incorrect properties', async () => {
      try {
        result = orderBook.add({
          id: `ask0`,
          type: 'limit',
          price: .4,
          targetChain: 'lsk',
          targetWalletAddress: '22245678912345678222L',
          senderId: '11111111111222222222L',
          side: 'ask',
          value: 250
        });
      } catch (err) {
        error = err;
      }
      assert(error != null);

      error = null;

      try {
        result = orderBook.add({
          id: `ask1`,
          type: 'limit',
          price: .4,
          targetChain: 'lsk',
          targetWalletAddress: '22245678912345678222L',
          senderId: '11111111111222222222L',
          side: 'ask'
        });
      } catch (err) {
        error = err;
      }
      assert(error != null);

      let allAsks = [...orderBook.getAskIteratorFromMin()];
      let allBids = [...orderBook.getBidIteratorFromMin()];
      assert(orderBook.askCount === allAsks.length);
      assert(orderBook.bidCount === allBids.length);
    });

    it('should throw an error if a bid order is added with missing or incorrect properties', async () => {
      try {
        result = orderBook.add({
          id: `bid0`,
          type: 'limit',
          price: .4,
          targetChain: 'lsk',
          targetWalletAddress: '22245678912345678222L',
          senderId: '11111111111222222222L',
          side: 'bid',
          size: 250
        });
      } catch (err) {
        error = err;
      }
      assert(error != null);

      error = null;

      try {
        result = orderBook.add({
          id: `bid1`,
          type: 'limit',
          price: .4,
          targetChain: 'lsk',
          targetWalletAddress: '22245678912345678222L',
          senderId: '11111111111222222222L',
          side: 'bid'
        });
      } catch (err) {
        error = err;
      }
      assert(error != null);

      error = null;

      try {
        result = orderBook.add({
          id: `bid2`,
          type: 'limit',
          price: .4,
          targetChain: 'lsk',
          targetWalletAddress: '22245678912345678222L',
          senderId: '11111111111222222222L',
          value: 100
        });
      } catch (err) {
        error = err;
      }
      assert(error != null);

      let allAsks = [...orderBook.getAskIteratorFromMin()];
      let allBids = [...orderBook.getBidIteratorFromMin()];
      assert(orderBook.askCount === allAsks.length);
      assert(orderBook.bidCount === allBids.length);
    });

    it('should remove matched bid orders from the order book', async () => {
      orderBook.add({
        id: `bid0`,
        type: 'limit',
        price: .5,
        targetChain: 'clsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'bid',
        value: 50
      });
      orderBook.add({
        id: `bid1`,
        type: 'limit',
        price: .6,
        targetChain: 'clsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'bid',
        value: 60
      });
      orderBook.add({
        id: `ask0`,
        type: 'limit',
        price: .4,
        targetChain: 'lsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'ask',
        size: 200
      });

      assert([...orderBook.askList.findEntriesFromMin()].length === 0);
      assert([...orderBook.bidList.findEntriesFromMin()].length === 0);

      let allAsks = [...orderBook.getAskIteratorFromMin()];
      let allBids = [...orderBook.getBidIteratorFromMin()];
      assert(orderBook.askCount === allAsks.length);
      assert(orderBook.bidCount === allBids.length);
    });

    it('should remove matched ask orders from the order book', async () => {
      orderBook.add({
        id: `ask0`,
        type: 'limit',
        price: .5,
        targetChain: 'lsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'ask',
        size: 100
      });
      orderBook.add({
        id: `ask1`,
        type: 'limit',
        price: .6,
        targetChain: 'lsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'ask',
        size: 100
      });
      orderBook.add({
        id: `bid0`,
        type: 'limit',
        price: .9,
        targetChain: 'clsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'bid',
        value: 110
      });

      assert([...orderBook.askList.findEntriesFromMin()].length === 0);
      assert([...orderBook.bidList.findEntriesFromMin()].length === 0);

      let allAsks = [...orderBook.getAskIteratorFromMin()];
      let allBids = [...orderBook.getBidIteratorFromMin()];
      assert(orderBook.askCount === allAsks.length);
      assert(orderBook.bidCount === allBids.length);
    });

    it('should support market bid orders', async () => {
      orderBook.add({
        id: `ask0`,
        type: 'limit',
        price: .5,
        targetChain: 'lsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'ask',
        size: 100
      });
      orderBook.add({
        id: `ask1`,
        type: 'limit',
        price: .6,
        targetChain: 'lsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'ask',
        size: 100
      });
      result = orderBook.add({
        id: `bid0`,
        type: 'market',
        targetChain: 'clsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'bid',
        value: 120
      });

      assert(result.takeSize === 200n);
      assert(result.takeValue === 110n);
      assert(result.taker.valueRemaining === 10n);
      assert(result.taker.lastValueTaken === 0n);
      assert(result.taker.lastSizeTaken === 0n);

      assert([...orderBook.askList.findEntriesFromMin()].length === 0);
      assert([...orderBook.bidList.findEntriesFromMin()].length === 0);

      let allAsks = [...orderBook.getAskIteratorFromMin()];
      let allBids = [...orderBook.getBidIteratorFromMin()];
      assert(orderBook.askCount === allAsks.length);
      assert(orderBook.bidCount === allBids.length);
    });

    it('should support market ask orders', async () => {
      orderBook.add({
        id: `bid0`,
        type: 'limit',
        price: .5,
        targetChain: 'clsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'bid',
        value: 50
      });
      orderBook.add({
        id: `bid1`,
        type: 'limit',
        price: .6,
        targetChain: 'clsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'bid',
        value: 60
      });
      result = orderBook.add({
        id: `ask0`,
        type: 'market',
        targetChain: 'lsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'ask',
        size: 220
      });

      assert(result.takeSize === 200n);
      assert(result.takeValue === 110n);
      assert(result.taker.sizeRemaining === 20n);
      assert(result.taker.lastValueTaken === 0n);
      assert(result.taker.lastSizeTaken === 0n);

      assert([...orderBook.askList.findEntriesFromMin()].length === 0);
      assert([...orderBook.bidList.findEntriesFromMin()].length === 0);

      let allAsks = [...orderBook.getAskIteratorFromMin()];
      let allBids = [...orderBook.getBidIteratorFromMin()];
      assert(orderBook.askCount === allAsks.length);
      assert(orderBook.bidCount === allBids.length);
    });

    it('should support minimum take size', async () => {
      orderBook = new BigOrderBook({
        minPartialTakeSize: 51
      });

      orderBook.add({
        id: `ask0`,
        type: 'limit',
        price: 2,
        targetChain: 'lsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'ask',
        size: 1000
      });
      orderBook.add({
        id: `ask1`,
        type: 'limit',
        price: 1,
        targetChain: 'lsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'ask',
        size: 1000
      });
      result = orderBook.add({
        id: `bid0`,
        type: 'market',
        targetChain: 'clsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'bid',
        value: 1100
      });

      assert(result.takeSize === 1000n);
      assert(result.takeValue === 1000n);
      assert(result.makers.length === 1);
      assert(result.makers[0].lastSizeTaken === 1000n);
      assert(result.makers[0].lastValueTaken === 1000n);
      assert(result.makers[0].sizeRemaining === 0n);
    });

    it('should support minimum take value', async () => {
      orderBook = new BigOrderBook({
        minPartialTakeValue: 51
      });

      orderBook.add({
        id: `bid0`,
        type: 'limit',
        price: 1,
        targetChain: 'clsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'bid',
        value: 1000
      });
      orderBook.add({
        id: `bid1`,
        type: 'limit',
        price: .5,
        targetChain: 'clsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'bid',
        value: 1000
      });
      result = orderBook.add({
        id: `ask0`,
        type: 'market',
        targetChain: 'lsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'ask',
        size: 1100
      });

      assert(result.takeSize === 1000n);
      assert(result.takeValue === 1000n);
      assert(result.makers.length === 1);
      assert(result.makers[0].lastSizeTaken === 1000n);
      assert(result.makers[0].lastValueTaken === 1000n);
      assert(result.makers[0].valueRemaining === 0n);
    });

    it('should fully remove an order which has been filled', async () => {
      orderBook = new BigOrderBook({
        minPartialTakeValue: 51
      });

      orderBook.add({
        id: `ask0`,
        type: 'limit',
        price: 1,
        targetChain: 'lsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'ask',
        size: 10
      });
      orderBook.add({
        id: `bid0`,
        type: 'limit',
        price: 1,
        targetChain: 'clsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222223333L',
        side: 'bid',
        value: 10
      });

      assert(orderBook.has('ask0') === false);
      assert(orderBook.has('bid0') === false);

      orderBook.add({
        id: `bid0`,
        type: 'limit',
        price: 1,
        targetChain: 'clsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222223333L',
        side: 'bid',
        value: 10
      });

      orderBook.add({
        id: `ask0`,
        type: 'limit',
        price: 1,
        targetChain: 'lsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'ask',
        size: 10
      });

      assert(orderBook.has('bid0') === false);
      assert(orderBook.has('ask0') === false);
    });
  });

  describe('#has', async () => {
    it('should support looking up orders by id', async () => {
      orderBook.add({
        id: `ask0`,
        type: 'limit',
        price: .5,
        targetChain: 'lsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'ask',
        size: 100
      });
      orderBook.add({
        id: `bid0`,
        type: 'limit',
        price: .4,
        targetChain: 'clsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'bid',
        value: 100
      });

      result = orderBook.has('ask1');
      assert(result === false);

      result = orderBook.has('bid1');
      assert(result === false);

      result = orderBook.has('ask0');
      assert(result === true);

      result = orderBook.has('bid0');
      assert(result === true);
    });
  });

  describe('#get', async () => {
    it('should support fetching orders by id', async () => {
      orderBook.add({
        id: `ask0`,
        type: 'limit',
        price: .5,
        targetChain: 'lsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'ask',
        size: 100
      });
      orderBook.add({
        id: `bid0`,
        type: 'limit',
        price: .4,
        targetChain: 'clsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'bid',
        value: 100
      });

      result = orderBook.get('ask1');
      assert(result === undefined);

      result = orderBook.get('bid1');
      assert(result === undefined);

      result = orderBook.get('ask0');
      assert(result != null);
      assert(result.type === 'limit');
      assert(result.price === .5);

      result = orderBook.get('bid0');
      assert(result != null);
      assert(result.type === 'limit');
      assert(result.price === .4);
    });
  });

  describe('#remove', async () => {
    beforeEach(async () => {
      orderBook.add({
        id: `ask0`,
        type: 'limit',
        price: .5,
        targetChain: 'lsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'ask',
        size: 100
      });
      orderBook.add({
        id: `ask1`,
        type: 'limit',
        price: .6,
        targetChain: 'lsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'ask',
        size: 100
      });
      orderBook.add({
        id: `bid0`,
        type: 'limit',
        price: .4,
        targetChain: 'clsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'bid',
        value: 100
      });
    });

    it('should remove orders that exist and return the removed orders', async () => {
      result = orderBook.remove('ask0');

      assert(result != null);
      assert(result.id === 'ask0');

      assert([...orderBook.askList.findEntriesFromMin()].length === 1);
      assert([...orderBook.bidList.findEntriesFromMin()].length === 1);

      result = orderBook.remove('bid0');

      assert(result != null);
      assert(result.id === 'bid0');

      assert([...orderBook.askList.findEntriesFromMin()].length === 1);
      assert([...orderBook.bidList.findEntriesFromMin()].length === 0);

      orderBook.remove('ask1');

      assert([...orderBook.askList.findEntriesFromMin()].length === 0);
      assert([...orderBook.bidList.findEntriesFromMin()].length === 0);

      let allAsks = [...orderBook.getAskIteratorFromMin()];
      let allBids = [...orderBook.getBidIteratorFromMin()];
      assert(orderBook.askCount === allAsks.length);
      assert(orderBook.bidCount === allBids.length);
    });

    it('should return undefined if the order does not exist', async () => {
      result = orderBook.remove('bid111');

      assert(result === undefined);
      assert([...orderBook.askList.findEntriesFromMin()].length === 2);
      assert([...orderBook.bidList.findEntriesFromMin()].length === 1);

      let allAsks = [...orderBook.getAskIteratorFromMin()];
      let allBids = [...orderBook.getBidIteratorFromMin()];
      assert(orderBook.askCount === allAsks.length);
      assert(orderBook.bidCount === allBids.length);
    });
  });

  describe('#findAsks', async () => {
    beforeEach(async () => {
      for (let i = 100; i >= 0; i--) {
        orderBook.add({
          id: `ask${i}`,
          type: 'limit',
          price: (i + 1) / 100,
          targetChain: 'lsk',
          targetWalletAddress: '22245678912345678222L',
          senderId: '11111111111222222222L',
          side: 'ask',
          size: (i + 1) * 10
        });
      }

      orderBook.add({
        id: 'bid0',
        type: 'limit',
        price: .0001,
        targetChain: 'clsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'bid',
        value: 10
      });
    });

    it('should iterate over ask orders in ascending order starting from the specified price', async () => {
      let iterator = orderBook.findAsks(0.5).asc;
      let prevAsk;
      for (let ask of iterator) {
        if (prevAsk) {
          assert(ask.price >= prevAsk.price);
        }
        prevAsk = ask;
      }
    });

    it('should iterate over ask orders in descending order starting from the specified price', async () => {
      let iterator = orderBook.findAsks(0.5).desc;
      let prevAsk;
      for (let ask of iterator) {
        if (prevAsk) {
          assert(ask.price <= prevAsk.price);
        }
        prevAsk = ask;
      }
    });
  });

  describe('#findBids', async () => {
    beforeEach(async () => {
      for (let i = 100; i >= 0; i--) {
        orderBook.add({
          id: `bid${i}`,
          type: 'limit',
          price: (i + 1) / 100,
          targetChain: 'clsk',
          targetWalletAddress: '22245678912345678222L',
          senderId: '11111111111222222222L',
          side: 'bid',
          value: (i + 1) * 10
        });
      }

      orderBook.add({
        id: 'ask0',
        type: 'limit',
        price: 100,
        targetChain: 'lsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'ask',
        size: 10
      });
    });

    it('should iterate over bid orders in ascending order starting from the specified price', async () => {
      let iterator = orderBook.findBids(0.5).asc;
      let prevBid;
      for (let bid of iterator) {
        if (prevBid) {
          assert(bid.price >= prevBid.price);
        }
        prevBid = bid;
      }
    });

    it('should iterate over bid orders in descending order starting from the specified price', async () => {
      let iterator = orderBook.findBids(0.5).desc;
      let prevBid;
      for (let bid of iterator) {
        if (prevBid) {
          assert(bid.price <= prevBid.price);
        }
        prevBid = bid;
      }
    });
  });

  describe('#getAskIteratorFromMin', async () => {
    beforeEach(async () => {
      for (let i = 99; i >= 0; i--) {
        orderBook.add({
          id: `ask${i}`,
          type: 'limit',
          price: (i + 1) / 100,
          targetChain: 'lsk',
          targetWalletAddress: '22245678912345678222L',
          senderId: '11111111111222222222L',
          side: 'ask',
          size: (i + 1) * 10
        });
      }

      orderBook.add({
        id: 'bid0',
        type: 'limit',
        price: .0001,
        targetChain: 'clsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'bid',
        value: 10
      });
    });

    it('should iterate over ask orders in ascending order starting from the min price', async () => {
      let iterator = orderBook.getAskIteratorFromMin();
      let prevAsk;
      for (let ask of iterator) {
        if (prevAsk) {
          assert(ask.price >= prevAsk.price);
        }
        prevAsk = ask;
      }
    });
  });

  describe('#getAskIteratorFromMax', async () => {
    beforeEach(async () => {
      for (let i = 0; i < 100; i++) {
        orderBook.add({
          id: `ask${i}`,
          type: 'limit',
          price: (i + 1) / 100,
          targetChain: 'lsk',
          targetWalletAddress: '22245678912345678222L',
          senderId: '11111111111222222222L',
          side: 'ask',
          size: (i + 1) * 10
        });
      }

      orderBook.add({
        id: 'bid0',
        type: 'limit',
        price: .0001,
        targetChain: 'clsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'bid',
        value: 10
      });
    });

    it('should iterate over ask orders in descending order starting from the max price', async () => {
      let iterator = orderBook.getAskIteratorFromMax();
      let prevAsk;
      for (let ask of iterator) {
        if (prevAsk) {
          assert(ask.price <= prevAsk.price);
        }
        prevAsk = ask;
      }
    });
  });

  describe('#getBidIteratorFromMin', async () => {
    beforeEach(async () => {
      for (let i = 100; i >= 0; i--) {
        orderBook.add({
          id: `bid${i}`,
          type: 'limit',
          price: (i + 1) / 100,
          targetChain: 'clsk',
          targetWalletAddress: '22245678912345678222L',
          senderId: '11111111111222222222L',
          side: 'bid',
          value: (i + 1) * 10
        });
      }

      orderBook.add({
        id: 'ask0',
        type: 'limit',
        price: 100,
        targetChain: 'lsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'ask',
        size: 10
      });
    });

    it('should iterate over bid orders in ascending order starting from the min price', async () => {
      let iterator = orderBook.getBidIteratorFromMin();
      let prevBid;
      for (let bid of iterator) {
        if (prevBid) {
          assert(bid.price >= prevBid.price);
        }
        prevBid = bid;
      }
    });
  });

  describe('#getBidIteratorFromMax', async () => {
    beforeEach(async () => {
      for (let i = 0; i < 100; i++) {
        orderBook.add({
          id: `bid${i}`,
          type: 'limit',
          price: (i + 1) / 100,
          targetChain: 'clsk',
          targetWalletAddress: '22245678912345678222L',
          senderId: '11111111111222222222L',
          side: 'bid',
          value: (i + 1) * 10
        });
      }

      orderBook.add({
        id: 'ask0',
        type: 'limit',
        price: 100,
        targetChain: 'lsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'ask',
        size: 10
      });
    });

    it('should iterate over bid orders in ascending order starting from the max price', async () => {
      let iterator = orderBook.getBidIteratorFromMax();
      let prevBid;
      for (let bid of iterator) {
        if (prevBid) {
          assert(bid.price <= prevBid.price);
        }
        prevBid = bid;
      }
    });
  });

  describe('#getAskLevelIteratorFromMin', async () => {
    beforeEach(async () => {
      for (let i = 99; i >= 0; i--) {
        orderBook.add({
          id: `ask${i}`,
          type: 'limit',
          price: (i + 1) / 100,
          targetChain: 'lsk',
          targetWalletAddress: '22245678912345678222L',
          senderId: '11111111111222222222L',
          side: 'ask',
          size: (i + 1) * 10
        });
      }

      orderBook.add({
        id: 'ask-extra',
        type: 'limit',
        price: .2,
        targetChain: 'lsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'ask',
        size: 10000
      });

      orderBook.add({
        id: 'bid0',
        type: 'limit',
        price: .0001,
        targetChain: 'clsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'bid',
        value: 10
      });
    });

    it('should iterate over ask levels in ascending order starting from the min price', async () => {
      let iterator = orderBook.getAskLevelIteratorFromMin();
      let prevAskLevel;
      for (let askLevel of iterator) {
        if (prevAskLevel) {
          assert(askLevel.price >= prevAskLevel.price);
        }
        prevAskLevel = askLevel;
      }
    });

    it('should combine volumes from multiple orders', async () => {
      let iterator = orderBook.getAskLevelIteratorFromMax();
      for (let askLevel of iterator) {
        if (askLevel.price === .2) {
          assert(askLevel.sizeRemaining === 10200n);
        }
      }
    });
  });

  describe('#getAskLevelIteratorFromMax', async () => {
    beforeEach(async () => {
      for (let i = 0; i < 100; i++) {
        orderBook.add({
          id: `ask${i}`,
          type: 'limit',
          price: (i + 1) / 100,
          targetChain: 'lsk',
          targetWalletAddress: '22245678912345678222L',
          senderId: '11111111111222222222L',
          side: 'ask',
          size: (i + 1) * 100
        });
      }

      orderBook.add({
        id: 'ask-extra',
        type: 'limit',
        price: .2,
        targetChain: 'lsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'ask',
        size: 20000
      });

      orderBook.add({
        id: 'bid0',
        type: 'limit',
        price: .0001,
        targetChain: 'clsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'bid',
        value: 100
      });

      orderBook.add({
        id: 'bid1',
        type: 'limit',
        price: 1,
        targetChain: 'clsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'bid',
        value: 10
      });
    });

    it('should iterate over ask levels in descending order starting from the max price', async () => {
      let iterator = orderBook.getAskLevelIteratorFromMax();
      let prevAskLevel;
      for (let askLevel of iterator) {
        if (prevAskLevel) {
          assert(askLevel.price <= prevAskLevel.price);
        }
        prevAskLevel = askLevel;
      }
    });

    it('should combine volumes from multiple orders', async () => {
      let iterator = orderBook.getAskLevelIteratorFromMax();
      for (let askLevel of iterator) {
        if (askLevel.price === .2) {
          assert(askLevel.sizeRemaining === 22000n);
        }
      }
    });

    it('should subtract volume partially', async () => {
      orderBook.remove('ask19');
      let iterator = orderBook.getAskLevelIteratorFromMax();
      let count = 0;
      for (let askLevel of iterator) {
        if (askLevel.price === .2) {
          assert(askLevel.sizeRemaining === 20000n);
        } else if (askLevel.price === .03) {
          assert(askLevel.sizeRemaining === 134n);
        }
        count++;
      }
      assert(count === 98);
    });

    it('should subtract volume completely', async () => {
      orderBook.remove('ask19');
      orderBook.remove('ask-extra');
      let iterator = orderBook.getAskLevelIteratorFromMax();
      for (let askLevel of iterator) {
        if (askLevel.price === .2) {
          // Should not reach here.
          assert(false);
        }
      }
    });
  });

  describe('#getBidLevelIteratorFromMin', async () => {
    beforeEach(async () => {
      for (let i = 99; i >= 0; i--) {
        orderBook.add({
          id: `bid${i}`,
          type: 'limit',
          price: (i + 1) / 100,
          targetChain: 'clsk',
          targetWalletAddress: '22245678912345678222L',
          senderId: '11111111111222222222L',
          side: 'bid',
          value: (i + 1) * 10
        });
      }

      orderBook.add({
        id: 'bid-extra',
        type: 'limit',
        price: .3,
        targetChain: 'clsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'bid',
        value: 3000
      });

      orderBook.add({
        id: 'ask0',
        type: 'limit',
        price: 100,
        targetChain: 'lsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'ask',
        size: 10
      });

      orderBook.add({
        id: 'ask1',
        type: 'limit',
        price: .01,
        targetChain: 'lsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'ask',
        size: 10100
      });
    });

    it('should iterate over bid level in ascending order starting from the min price', async () => {
      let iterator = orderBook.getBidLevelIteratorFromMin();
      let prevBidLevel;
      for (let bidLevel of iterator) {
        if (prevBidLevel) {
          assert(bidLevel.price >= prevBidLevel.price);
        }
        prevBidLevel = bidLevel;
      }
    });

    it('should combine volumes from multiple orders', async () => {
      let iterator = orderBook.getBidLevelIteratorFromMin();
      for (let bidLevel of iterator) {
        if (bidLevel.price === .3) {
          assert(bidLevel.valueRemaining === 3300n);
        }
      }
    });

    it('should subtract volume partially', async () => {
      orderBook.remove('bid-extra');
      let iterator = orderBook.getBidLevelIteratorFromMin();
      let count = 0;
      for (let bidLevel of iterator) {
        if (bidLevel.price === .3) {
          assert(bidLevel.valueRemaining === 300n);
        } else if (bidLevel.price === .9) {
          assert(bidLevel.valueRemaining === 810n);
        }
        count++;
      }
      assert(count === 90);
    });

    it('should subtract volume completely', async () => {
      orderBook.remove('bid29');
      orderBook.remove('bid-extra');
      let iterator = orderBook.getBidLevelIteratorFromMin();
      for (let bidLevel of iterator) {
        if (bidLevel.price === .3) {
          // Should not reach here.
          assert(false);
        }
      }
    });
  });

  describe('#getBidLevelIteratorFromMax', async () => {
    beforeEach(async () => {
      for (let i = 0; i < 100; i++) {
        orderBook.add({
          id: `bid${i}`,
          type: 'limit',
          price: (i + 1) / 100,
          targetChain: 'clsk',
          targetWalletAddress: '22245678912345678222L',
          senderId: '11111111111222222222L',
          side: 'bid',
          value: (i + 1) * 10
        });
      }

      orderBook.add({
        id: 'bid-extra',
        type: 'limit',
        price: .3,
        targetChain: 'clsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'bid',
        value: 10000
      });

      orderBook.add({
        id: 'ask0',
        type: 'limit',
        price: 100,
        targetChain: 'lsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'ask',
        size: 10
      });
    });

    it('should iterate over bid levels in ascending order starting from the max price', async () => {
      let iterator = orderBook.getBidLevelIteratorFromMax();
      let prevBidLevel;
      for (let bidLevel of iterator) {
        if (bidLevel.price === .3) {
          assert(bidLevel.valueRemaining === 10300n);
        }
        if (prevBidLevel) {
          assert(bidLevel.price <= prevBidLevel.price);
        }
        prevBidLevel = bidLevel;
      }
    });

    it('should combine volumes from multiple orders', async () => {
      let iterator = orderBook.getBidLevelIteratorFromMax();
      for (let bidLevel of iterator) {
        if (bidLevel.price === .3) {
          assert(bidLevel.valueRemaining === 10300n);
        }
      }
    });
  });

  describe('#clear', async () => {
    beforeEach(async () => {
      for (let i = 0; i < 100; i++) {
        orderBook.add({
          id: `ask${i}`,
          type: 'limit',
          price: (i + 101) / 100,
          targetChain: 'lsk',
          targetWalletAddress: '22245678912345678222L',
          senderId: '11111111111222222222L',
          side: 'ask',
          size: (i + 1) * 10
        });
      }
      for (let i = 0; i < 100; i++) {
        orderBook.add({
          id: `bid${i}`,
          type: 'limit',
          price: (i + 1) / 100,
          targetChain: 'clsk',
          targetWalletAddress: '22245678912345678222L',
          senderId: '11111111111222222222L',
          side: 'bid',
          value: (i + 1) * 10
        });
      }
    });

    it('should remove all entries from the order book', async () => {
      orderBook.clear();
      assert([...orderBook.getAskIteratorFromMin()].length === 0);
      assert([...orderBook.getBidIteratorFromMin()].length === 0);
      assert([...orderBook.askList.findEntriesFromMin()].length === 0);
      assert([...orderBook.bidList.findEntriesFromMin()].length === 0);

      let allAsks = [...orderBook.getAskIteratorFromMin()];
      let allBids = [...orderBook.getBidIteratorFromMin()];

      assert(orderBook.askCount === allAsks.length);
      assert(orderBook.bidCount === allBids.length);
    });
  });
});

describe('BigOrderBook security regression tests', async () => {
  let orderBook;
  let result;

  // Builds an order with the ancillary properties which a DEX would attach, so
  // that the assertions below only have to mention the properties under test.
  function makeOrder(order) {
    return {
      targetChain: order.side === 'ask' ? 'lsk' : 'clsk',
      targetWalletAddress: '22245678912345678222L',
      senderId: '11111111111222222222L',
      type: 'limit',
      ...order
    };
  }

  function addOrder(book, order) {
    return book.add(makeOrder(order));
  }

  function captureError(callback) {
    try {
      callback();
    } catch (err) {
      return err;
    }
    return null;
  }

  // An order whose remaining amount is too small to convert at its own price can
  // never be filled; it is skipped by the matching loop and left for its sender to
  // cancel, so it is allowed to sit on the wrong side of the spread.
  function isFillable(book, order) {
    if (order.side === 'ask') {
      return book._convertSizeToValue(order.sizeRemaining, order.price) > 0n;
    }
    return book._convertValueToSize(order.valueRemaining, order.price) > 0n;
  }

  // The book is only consistent if every aggregate can be recomputed from the
  // orders which are actually linked into it.
  function assertBookIsConsistent(book) {
    let sides = [
      ['ask', book.askList, 'sizeRemaining', book.askCount],
      ['bid', book.bidList, 'valueRemaining', book.bidCount]
    ];
    for (let [side, priceList, remainingProperty, expectedCount] of sides) {
      let orderCount = 0;
      for (let [price, priceOrderLinkedList] of priceList.findEntriesFromMin()) {
        if (price === undefined) {
          break;
        }
        assert(priceOrderLinkedList.head != null);
        let remainingTotal = 0n;
        let levelOrderCount = 0;
        for (let item = priceOrderLinkedList.head; item; item = item.next) {
          assert(book.orderItemMap.get(item.order.id) === item);
          assert(item.order.price === price);
          assert(item.order[remainingProperty] > 0n);
          remainingTotal += item.order[remainingProperty];
          levelOrderCount++;
        }
        assert(priceOrderLinkedList[remainingProperty] === remainingTotal);
        assert(priceOrderLinkedList.size === levelOrderCount);
        orderCount += levelOrderCount;
      }
      assert(orderCount === expectedCount);
    }
    let minAsk = book.getMinAsk();
    let maxBid = book.getMaxBid();
    if (minAsk && maxBid && isFillable(book, minAsk) && isFillable(book, maxBid)) {
      assert(maxBid.price < minAsk.price);
    }
  }

  beforeEach(async () => {
    orderBook = new BigOrderBook({
      priceDecimalPrecision: 4
    });
  });

  describe('order size and value validation', async () => {
    it('should reject a negative or zero ask size', async () => {
      for (let size of [-1000000, -1, 0, -1000000n, 0n, '-5']) {
        let error = captureError(() => addOrder(orderBook, {id: `ask-${size}`, price: .5, side: 'ask', size}));
        assert(error != null);
      }
      assert(orderBook.askCount === 0);
      assertBookIsConsistent(orderBook);
    });

    it('should reject a negative or zero bid value', async () => {
      for (let value of [-1000000, -1, 0, -1000000n, 0n, '-5']) {
        let error = captureError(() => addOrder(orderBook, {id: `bid-${value}`, price: .5, side: 'bid', value}));
        assert(error != null);
      }
      assert(orderBook.bidCount === 0);
      assertBookIsConsistent(orderBook);
    });

    it('should not let a negative size ask inflate the taker or drain resting makers', async () => {
      addOrder(orderBook, {id: `ask0`, price: 1, side: 'ask', size: 1000});
      addOrder(orderBook, {id: `ask1`, price: 2, side: 'ask', size: 1000});

      // A negative size used to reverse every subtraction in the matching loop,
      // which let the taker finish with more value than it started with.
      let error = captureError(() => addOrder(orderBook, {id: `evil`, price: .5, side: 'ask', size: -1000000}));
      assert(error != null);
      assert(orderBook.has('evil') === false);
      assert(orderBook.askCount === 2);

      result = addOrder(orderBook, {id: `bid0`, price: 5, side: 'bid', value: 10});

      assert(result.taker.valueRemaining === 0n);
      assert(result.takeSize === 10n);
      assert(result.takeValue === 10n);
      assert(result.makers.length === 1);
      assert(orderBook.get('ask0').sizeRemaining === 990n);
      assert(orderBook.has('ask1') === true);
      assertBookIsConsistent(orderBook);
    });

    it('should not let a negative value bid inflate the taker', async () => {
      let error = captureError(() => addOrder(orderBook, {id: `evil`, price: 10, side: 'bid', value: -1000000}));
      assert(error != null);
      assert(orderBook.bidCount === 0);

      result = addOrder(orderBook, {id: `ask0`, price: 1, side: 'ask', size: 5});

      assert(result.taker.sizeRemaining === 5n);
      assert(result.takeSize === 0n);
      assert(result.takeValue === 0n);
      assertBookIsConsistent(orderBook);
    });

    it('should reject amounts which are not integers and accept BigInt and string amounts', async () => {
      let error = captureError(() => addOrder(orderBook, {id: `ask0`, price: .5, side: 'ask', size: 1.5}));
      assert(error != null);

      // A number this large cannot be represented exactly, so converting it to a
      // BigInt would silently change the amount.
      error = captureError(() => addOrder(orderBook, {id: `ask1`, price: .5, side: 'ask', size: 1e30}));
      assert(error != null);

      error = captureError(() => addOrder(orderBook, {id: `ask2`, price: .5, side: 'ask', size: 'abc'}));
      assert(error != null);

      addOrder(orderBook, {id: `ask3`, price: .5, side: 'ask', size: '100'});
      assert(orderBook.get('ask3').sizeRemaining === 100n);

      addOrder(orderBook, {id: `ask4`, price: .6, side: 'ask', size: 100n});
      assert(orderBook.get('ask4').sizeRemaining === 100n);

      addOrder(orderBook, {id: `ask5`, price: .7, side: 'ask', size: BigInt('1000000000000000000000000000000')});
      assert(orderBook.get('ask5').sizeRemaining === 1000000000000000000000000000000n);

      assert(orderBook.askCount === 3);
      assertBookIsConsistent(orderBook);
    });
  });

  describe('partial fill accounting', async () => {
    it('should report a take value which matches the value credited to the makers', async () => {
      addOrder(orderBook, {id: `ask0`, price: 3, side: 'ask', size: 1000});
      result = addOrder(orderBook, {id: `bid0`, price: 3, side: 'bid', value: 5});

      // The maker gives up 1 unit of size, so it must be credited the value of 1
      // unit of size and not the taker's whole remaining value of 5.
      assert(result.makers.length === 1);
      assert(result.makers[0].lastSizeTaken === 1n);
      assert(result.makers[0].lastValueTaken === 3n);
      assert(result.makers[0].sizeRemaining === 999n);
      assert(result.takeSize === 1n);
      assert(result.takeValue === 3n);
      assertBookIsConsistent(orderBook);
    });

    it('should report a take size which matches the size credited to the makers', async () => {
      addOrder(orderBook, {id: `bid0`, price: .3, side: 'bid', value: 1000});
      result = addOrder(orderBook, {id: `ask0`, price: .3, side: 'ask', size: 5});

      assert(result.makers.length === 1);
      assert(result.makers[0].lastSizeTaken === 5n);
      assert(result.makers[0].lastValueTaken === 1n);
      assert(result.takeSize === 5n);
      assert(result.takeValue === 1n);
      assertBookIsConsistent(orderBook);
    });

    it('should not credit a maker for a fill which rounds down to no size', async () => {
      addOrder(orderBook, {id: `ask0`, price: 1000, side: 'ask', size: 10000});
      // 999 of value buys less than one unit of size at a price of 1000.
      result = addOrder(orderBook, {id: `bid0`, price: 1000, side: 'bid', value: 999});

      assert(result.makers.length === 0);
      assert(result.takeSize === 0n);
      assert(result.takeValue === 0n);
      assert(orderBook.get('ask0').sizeRemaining === 10000n);
      assert(orderBook.get('ask0').lastSizeTaken === 0n);
      assert(orderBook.has('bid0') === false);
      // Nothing was traded, so the whole order is given up.
      assert(result.taker.valueRemaining === 0n);
      assert(BigInt(result.taker.value) - result.takeValue === 999n);
      assertBookIsConsistent(orderBook);
    });

    it('should not credit a maker for a fill which rounds down to no value', async () => {
      addOrder(orderBook, {id: `bid0`, price: .0001, side: 'bid', value: 1000});
      // 5000 units of size is worth less than 1 of value at a price of .0001, so
      // the maker must not be credited the size for free. Repeating the attempt
      // must not deplete the maker either.
      for (let i = 0; i < 3; i++) {
        result = addOrder(orderBook, {id: `ask${i}`, price: .0001, side: 'ask', size: 5000});

        assert(result.makers.length === 0);
        assert(result.takeSize === 0n);
        assert(result.takeValue === 0n);
        assert(orderBook.get('bid0').valueRemaining === 1000n);
        assert(orderBook.get('bid0').lastSizeTaken === 0n);
        assert(result.taker.sizeRemaining === 0n);
        assert(BigInt(result.taker.size) - result.takeSize === 5000n);
        assert(orderBook.has(`ask${i}`) === false);
      }
      assert(orderBook.bidCount === 1);
      assert(orderBook.askCount === 0);
      assertBookIsConsistent(orderBook);
    });

    it('should not pay a taker for a maker whose remaining value cannot buy any size', async () => {
      // 1 of value cannot buy a whole unit of size at a price of 3, so this bid is
      // stranded. Taking it used to hand the taker its whole remaining value in
      // exchange for no size at all.
      addOrder(orderBook, {id: `bid0`, price: 3, side: 'bid', value: 1});
      result = addOrder(orderBook, {id: `ask0`, price: 1, side: 'ask', size: 10});

      assert(result.makers.length === 0);
      assert(result.takeSize === 0n);
      assert(result.takeValue === 0n);
      assert(orderBook.get('bid0').valueRemaining === 1n);
      assert(orderBook.get('ask0').sizeRemaining === 10n);
      assertBookIsConsistent(orderBook);

      // The stranded order must not block a maker behind it from being filled.
      addOrder(orderBook, {id: `bid1`, price: 3, side: 'bid', value: 100});
      result = addOrder(orderBook, {id: `ask1`, price: 1, side: 'ask', size: 10});

      assert(result.makers.length === 1);
      assert(result.makers[0].id === 'bid1');
      assert(result.takeSize === 10n);
      assert(result.takeValue === 30n);
      assert(orderBook.get('bid0').valueRemaining === 1n);
      assertBookIsConsistent(orderBook);
    });

    it('should not pay a taker for a maker whose remaining size is not worth any value', async () => {
      // 3 units of size are worth less than 1 of value at a price of .0001.
      addOrder(orderBook, {id: `ask0`, price: .0001, side: 'ask', size: 3});
      result = addOrder(orderBook, {id: `bid0`, price: 1, side: 'bid', value: 10});

      assert(result.makers.length === 0);
      assert(result.takeSize === 0n);
      assert(result.takeValue === 0n);
      assert(orderBook.get('ask0').sizeRemaining === 3n);
      assert(orderBook.get('bid0').valueRemaining === 10n);
      assertBookIsConsistent(orderBook);
    });

    it('should zero a remainder which was too small to trade so it cannot rest as dust', async () => {
      // 5 of value buys 1 unit of size at a price of 3. The leftover 2 cannot buy
      // anything, so the taker is finished and must not rest in the book as a dust
      // order; the amount given up is value minus takeValue.
      addOrder(orderBook, {id: `ask0`, price: 3, side: 'ask', size: 1000});
      result = addOrder(orderBook, {id: `bid0`, price: 3, side: 'bid', value: 5});

      assert(result.takeValue === 3n);
      assert(result.taker.valueRemaining === 0n);
      assert(BigInt(result.taker.value) - result.takeValue === 2n);
      assert(orderBook.has('bid0') === false);
      assert(orderBook.bidCount === 0);
      assertBookIsConsistent(orderBook);

      // An ask taker sells all of its remaining size in the same situation, so there
      // is nothing to give up.
      addOrder(orderBook, {id: `bid1`, price: .3, side: 'bid', value: 1000});
      result = addOrder(orderBook, {id: `ask1`, price: .3, side: 'ask', size: 5});

      assert(result.takeSize === 5n);
      assert(result.taker.sizeRemaining === 0n);
      assert(BigInt(result.taker.size) - result.takeSize === 0n);
      assert(orderBook.has('ask1') === false);
      assertBookIsConsistent(orderBook);
    });

    it('should keep a skipped maker in the order book when the levels around it are emptied', async () => {
      // The ask at .6 is worth no value at all, so it has to survive a sweep which
      // empties the levels on either side of it. Those levels are dropped with a
      // range delete, which would otherwise take the skipped maker's level with it
      // while the order itself stayed counted.
      addOrder(orderBook, {id: `ask0`, price: .5, side: 'ask', size: 10});
      addOrder(orderBook, {id: `dust`, price: .6, side: 'ask', size: 1});
      addOrder(orderBook, {id: `ask1`, price: .7, side: 'ask', size: 10});

      result = addOrder(orderBook, {id: `bid0`, price: 1, side: 'bid', value: 100});

      assert(result.makers.length === 2);
      assert(result.makers[0].id === 'ask0');
      assert(result.makers[1].id === 'ask1');
      assert(result.takeSize === 20n);
      assert(result.takeValue === 12n);
      assert(orderBook.has('ask0') === false);
      assert(orderBook.has('ask1') === false);
      assert(orderBook.has('dust') === true);
      assert(orderBook.askCount === 1);
      assert(orderBook.getMinAsk().id === 'dust');
      assert(orderBook.get('dust').sizeRemaining === 1n);
      assertBookIsConsistent(orderBook);

      // The skipped maker is still a normal order which its sender can cancel.
      assert(orderBook.remove('dust').id === 'dust');
      assert(orderBook.askCount === 0);
      assert([...orderBook.askList.findEntriesFromMin()].length === 0);
      assertBookIsConsistent(orderBook);
    });

    it('should keep the take totals equal to the sum of the maker legs across many fills', async () => {
      let seed = 7919;
      let random = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
      };
      let fillCount = 0;
      for (let run = 0; run < 50; run++) {
        orderBook = new BigOrderBook({priceDecimalPrecision: 4});
        for (let i = 0; i < 40; i++) {
          let price = Math.round((.1 + random() * 20) * 10000) / 10000;
          let amount = BigInt(1 + Math.floor(random() * 500));
          let side = random() < .5 ? 'ask' : 'bid';
          result = addOrder(
            orderBook,
            side === 'ask' ?
              {id: `ask${run}_${i}`, price, side, size: amount} :
              {id: `bid${run}_${i}`, price, side, value: amount}
          );
          let makerSizeTotal = result.makers.reduce((total, maker) => total + maker.lastSizeTaken, 0n);
          let makerValueTotal = result.makers.reduce((total, maker) => total + maker.lastValueTaken, 0n);
          assert(result.takeSize === makerSizeTotal);
          assert(result.takeValue === makerValueTotal);
          // A taker can never have more traded plus left over than it committed.
          if (side === 'ask') {
            assert(result.takeSize + result.taker.sizeRemaining <= amount);
          } else {
            assert(result.takeValue + result.taker.valueRemaining <= amount);
          }
          if (result.makers.length) {
            fillCount++;
          }
          assertBookIsConsistent(orderBook);
        }
      }
      // Guards against the loop above silently stopping to produce any fills.
      assert(fillCount > 100);
    });

    it('should still honour the minimum partial take thresholds', async () => {
      orderBook = new BigOrderBook({priceDecimalPrecision: 4, minPartialTakeSize: 51});

      addOrder(orderBook, {id: `ask0`, price: 2, side: 'ask', size: 1000});
      addOrder(orderBook, {id: `ask1`, price: 1, side: 'ask', size: 1000});
      result = orderBook.add(makeOrder({id: `bid0`, type: 'market', side: 'bid', value: 1100}));

      // The 100 of value left over after ask1 only buys 50 of size at a price of
      // 2, which is below the minimum take size, so it is intentionally given up
      // rather than being used to nibble at ask0.
      assert(result.takeSize === 1000n);
      assert(result.takeValue === 1000n);
      assert(result.makers.length === 1);
      assert(orderBook.get('ask0').sizeRemaining === 1000n);
      // The 100 which could not be taken is given up; it is recoverable from
      // value minus takeValue.
      assert(result.taker.valueRemaining === 0n);
      assert(BigInt(result.taker.value) - result.takeValue === 100n);
      assert(orderBook.has('bid0') === false);
      assertBookIsConsistent(orderBook);
    });
  });

  describe('price validation', async () => {
    it('should reject a price which rounds down to zero at the configured precision', async () => {
      for (let price of [.00004, .00001, 1e-30]) {
        let error = captureError(() => addOrder(orderBook, {id: `ask-${price}`, price, side: 'ask', size: 100}));
        assert(error != null);
        error = captureError(() => addOrder(orderBook, {id: `bid-${price}`, price, side: 'bid', value: 100}));
        assert(error != null);
      }
      // Half of the smallest increment still rounds up to a usable price.
      addOrder(orderBook, {id: `ask0`, price: .00005, side: 'ask', size: 100});
      assert(orderBook.get('ask0').price === .0001);
      assertBookIsConsistent(orderBook);
    });

    it('should reject a price which is not a finite number', async () => {
      for (let price of [NaN, Infinity, -Infinity, 'abc', null, undefined, {}]) {
        let error = captureError(() => addOrder(orderBook, {id: `ask-${price}`, price, side: 'ask', size: 100}));
        assert(error != null);
        error = captureError(() => addOrder(orderBook, {id: `bid-${price}`, price, side: 'bid', value: 100}));
        assert(error != null);
      }
      assert(orderBook.askCount === 0);
      assert(orderBook.bidCount === 0);
      assertBookIsConsistent(orderBook);
    });

    it('should reject a price which is too large for the configured precision', async () => {
      let error = captureError(() => addOrder(orderBook, {id: `ask0`, price: 1e300, side: 'ask', size: 100}));
      assert(error != null);
      assert(orderBook.askCount === 0);
    });

    it('should reject a priceDecimalPrecision which cannot be represented exactly', async () => {
      let error = captureError(() => new BigOrderBook({priceDecimalPrecision: 400}));
      assert(error != null);
      error = captureError(() => new BigOrderBook({priceDecimalPrecision: -1}));
      assert(error != null);
      error = captureError(() => new BigOrderBook({priceDecimalPrecision: 2.5}));
      assert(error != null);
    });

    it('should keep matching after a rejected price so the book cannot be poisoned', async () => {
      // A price of 0 used to be stored as-is and made every later crossing order
      // throw a division by zero, which left the book permanently unusable.
      let error = captureError(() => addOrder(orderBook, {id: `poison`, price: .00004, side: 'ask', size: 1}));
      assert(error != null);

      addOrder(orderBook, {id: `ask0`, price: .5, side: 'ask', size: 100});
      result = addOrder(orderBook, {id: `bid0`, price: .5, side: 'bid', value: 10});

      assert(result.takeSize === 20n);
      assert(result.takeValue === 10n);

      result = orderBook.add(makeOrder({id: `bid1`, type: 'market', side: 'bid', value: 5}));
      assert(result.takeValue === 5n);
      assertBookIsConsistent(orderBook);
    });
  });

  describe('order state property validation', async () => {
    it('should accept computed order state properties by default and reject them in strict mode', async () => {
      // Accepted by default so that a host application can rehydrate a snapshot.
      addOrder(orderBook, {id: `ask0`, price: 1, side: 'ask', size: 100, sizeRemaining: 40});
      assert(orderBook.get('ask0').sizeRemaining === 40n);
      assert(orderBook.getAskLevelIteratorFromMin().next().value.sizeRemaining === 40n);

      // They are still validated like any other amount.
      for (let sizeRemaining of [-5, 0, 1.5]) {
        let error = captureError(
          () => addOrder(orderBook, {id: `ask-${sizeRemaining}`, price: 1, side: 'ask', size: 100, sizeRemaining})
        );
        assert(error != null);
      }

      // strictOrderState refuses them, for a host which passes untrusted order
      // objects straight to add().
      let strictBook = new BigOrderBook({priceDecimalPrecision: 4, strictOrderState: true});
      for (let property of ['sizeRemaining', 'lastSizeTaken', 'lastValueTaken']) {
        let error = captureError(
          () => strictBook.add(makeOrder({id: `ask-${property}`, price: 1, side: 'ask', size: 1, [property]: 1000000}))
        );
        assert(error != null);
      }
      for (let property of ['valueRemaining', 'lastSizeTaken', 'lastValueTaken']) {
        let error = captureError(
          () => strictBook.add(makeOrder({id: `bid-${property}`, price: 1, side: 'bid', value: 1, [property]: 1000000}))
        );
        assert(error != null);
      }
      assert(strictBook.askCount === 0);
      assert(strictBook.bidCount === 0);

      // The restore option is the explicit way past it.
      strictBook.add(makeOrder({id: `ask9`, price: 1, side: 'ask', size: 100, sizeRemaining: 40}), {restore: true});
      assert(strictBook.get('ask9').sizeRemaining === 40n);
      assertBookIsConsistent(strictBook);
      assertBookIsConsistent(orderBook);
    });

    it('should only prevent a declared size being bypassed when strictOrderState is set', async () => {
      // Without the option the order book trusts the caller, which is what makes
      // snapshot restore possible; such a host must build its own order objects
      // rather than forwarding a submitted one.
      addOrder(orderBook, {id: `bid0`, price: 1, side: 'bid', value: 1000000});
      result = addOrder(orderBook, {id: `cheat`, price: 1, side: 'ask', size: 1, sizeRemaining: 1000});
      assert(result.takeSize === 1000n);

      let strictBook = new BigOrderBook({priceDecimalPrecision: 4, strictOrderState: true});
      strictBook.add(makeOrder({id: `bid0`, price: 1, side: 'bid', value: 1000000}));
      let error = captureError(
        () => strictBook.add(makeOrder({id: `cheat`, price: 1, side: 'ask', size: 1, sizeRemaining: 1000}))
      );
      assert(error != null);
      assert(strictBook.get('bid0').valueRemaining === 1000000n);

      result = strictBook.add(makeOrder({id: `honest`, price: 1, side: 'ask', size: 1}));
      assert(result.takeSize === 1n);
      assertBookIsConsistent(strictBook);
      assertBookIsConsistent(orderBook);
    });

    it('should accept order state properties when restoring a trusted snapshot', async () => {
      addOrder(orderBook, {id: `ask0`, price: .5, side: 'ask', size: 100});
      addOrder(orderBook, {id: `bid0`, price: .5, side: 'bid', value: 10});

      let snapshot = orderBook.get('ask0');
      assert(snapshot.sizeRemaining === 80n);
      assert(snapshot.lastSizeTaken === 20n);
      assert(snapshot.lastValueTaken === 10n);

      orderBook.clear();
      orderBook.add(snapshot, {restore: true});

      let restored = orderBook.get('ask0');
      assert(restored.sizeRemaining === 80n);
      assert(restored.lastSizeTaken === 20n);
      assert(restored.lastValueTaken === 10n);
      assert(restored.price === .5);
      assert(orderBook.getAskLevelIteratorFromMin().next().value.sizeRemaining === 80n);
      assertBookIsConsistent(orderBook);

      // Restoring still cannot introduce a non-positive remaining amount.
      let error = captureError(
        () => orderBook.add({...snapshot, id: 'ask1', sizeRemaining: -5}, {restore: true})
      );
      assert(error != null);
    });
  });

  describe('order type validation', async () => {
    it('should reject an order type which is not limit or market', async () => {
      for (let type of ['limitt', 'LIMIT', '', null, undefined, 0]) {
        let error = captureError(() => orderBook.add(makeOrder({id: `ask-${type}`, type, price: 1, side: 'ask', size: 1})));
        assert(error != null);
      }
      assert(orderBook.askCount === 0);
    });

    it('should not let an unrecognized order type sweep past the order price', async () => {
      addOrder(orderBook, {id: `ask0`, price: 1, side: 'ask', size: 100});
      addOrder(orderBook, {id: `ask1`, price: 99999, side: 'ask', size: 100});

      // A typo in the type used to turn this into a market order which ignored
      // its own price and filled against ask1.
      let error = captureError(
        () => orderBook.add(makeOrder({id: `bid0`, type: 'limitt', price: 1, side: 'bid', value: 1000000}))
      );
      assert(error != null);
      assert(orderBook.has('ask1') === true);
      assert(orderBook.get('ask1').sizeRemaining === 100n);

      result = addOrder(orderBook, {id: `bid1`, price: 1, side: 'bid', value: 1000000});
      assert(result.makers.length === 1);
      assert(result.makers[0].id === 'ask0');
      assert(orderBook.get('ask1').sizeRemaining === 100n);
      assertBookIsConsistent(orderBook);
    });
  });

  describe('order isolation', async () => {
    it('should write the computed order state onto the order object which was passed in', async () => {
      // A host application tracks a resting order by keeping its own reference, so
      // the order book holds the object it was given and keeps it current.
      let order = makeOrder({id: `bid0`, price: .50004, side: 'bid', value: 10000});
      orderBook.add(order);

      assert(order.price === .5);
      assert(order.valueRemaining === 10000n);
      assert(order.lastSizeTaken === 0n);
      assert(order.lastValueTaken === 0n);
      assert(orderBook.get('bid0').valueRemaining === 10000n);

      // The caller's reference has to follow the order as it is filled.
      addOrder(orderBook, {id: `ask0`, price: .5, side: 'ask', size: 100});

      assert(order.valueRemaining === 9950n);
      assert(order.lastSizeTaken === 100n);
      assert(order.lastValueTaken === 50n);
      assert(orderBook.get('bid0').valueRemaining === order.valueRemaining);
      assertBookIsConsistent(orderBook);
    });

    it('should leave the order object untouched when the order is rejected', async () => {
      // Validation runs before anything is written, so a thrown error cannot leave
      // a half-initialised order behind for the caller to misread.
      let badAmount = makeOrder({id: `bid1`, price: .50004, side: 'bid', value: -5});
      assert(captureError(() => orderBook.add(badAmount)) != null);
      assert(badAmount.price === .50004);
      assert(badAmount.valueRemaining === undefined);
      assert(badAmount.lastSizeTaken === undefined);
      assert(badAmount.lastValueTaken === undefined);

      let badPrice = makeOrder({id: `bid2`, price: .00004, side: 'bid', value: 100});
      assert(captureError(() => orderBook.add(badPrice)) != null);
      assert(badPrice.price === .00004);
      assert(badPrice.valueRemaining === undefined);

      assert(orderBook.bidCount === 0);
      assertBookIsConsistent(orderBook);
    });

    it('should not expose the stored order through get', async () => {
      addOrder(orderBook, {id: `ask0`, price: .5, side: 'ask', size: 100});

      let order = orderBook.get('ask0');
      order.sizeRemaining = 10n ** 30n;
      order.price = .0001;

      assert(orderBook.get('ask0').sizeRemaining === 100n);
      assert(orderBook.get('ask0').price === .5);
      assert(orderBook.getMinAsk().price === .5);
      assert(orderBook.getAskLevelIteratorFromMin().next().value.sizeRemaining === 100n);
      assertBookIsConsistent(orderBook);

      // Mutating a returned order used to repoint it at a price level which does
      // not exist, which left an empty level behind on removal.
      orderBook.remove('ask0');
      assert(orderBook.getMinAsk() === undefined);
      assert([...orderBook.askList.findEntriesFromMin()].length === 0);
      assertBookIsConsistent(orderBook);
    });

    it('should not expose the stored order through the order iterators', async () => {
      addOrder(orderBook, {id: `ask0`, price: .5, side: 'ask', size: 100});
      addOrder(orderBook, {id: `ask1`, price: .6, side: 'ask', size: 200});

      for (let order of orderBook.getAskIteratorFromMin()) {
        order.sizeRemaining = 0n;
        order.price = .0001;
      }
      for (let order of orderBook.findAsks(.5).asc) {
        order.sizeRemaining = 0n;
      }

      assert(orderBook.get('ask0').sizeRemaining === 100n);
      assert(orderBook.get('ask1').sizeRemaining === 200n);
      assertBookIsConsistent(orderBook);
    });

    it('should not expose the stored order through remove or the best price getters', async () => {
      addOrder(orderBook, {id: `ask0`, price: .5, side: 'ask', size: 100});
      addOrder(orderBook, {id: `ask1`, price: .6, side: 'ask', size: 200});
      addOrder(orderBook, {id: `bid0`, price: .4, side: 'bid', value: 100});

      orderBook.getMinAsk().sizeRemaining = 0n;
      orderBook.getMaxAsk().sizeRemaining = 0n;
      orderBook.getMinBid().valueRemaining = 0n;
      orderBook.getMaxBid().valueRemaining = 0n;
      assert(orderBook.get('ask0').sizeRemaining === 100n);
      assert(orderBook.get('bid0').valueRemaining === 100n);

      let removed = orderBook.remove('ask1');
      removed.sizeRemaining = 0n;
      assert(orderBook.has('ask1') === false);
      assert(orderBook.get('ask0').sizeRemaining === 100n);
      assertBookIsConsistent(orderBook);
    });
  });

  describe('order book growth', async () => {
    it('should not let a zero amount order rest in the order book', async () => {
      let error = captureError(() => addOrder(orderBook, {id: `bid0`, price: 5, side: 'bid', value: 0}));
      assert(error != null);
      error = captureError(() => addOrder(orderBook, {id: `ask0`, price: 9, side: 'ask', size: 0}));
      assert(error != null);

      assert(orderBook.askCount === 0);
      assert(orderBook.bidCount === 0);
      assert([...orderBook.askList.findEntriesFromMin()].length === 0);
      assert([...orderBook.bidList.findEntriesFromMin()].length === 0);
      assertBookIsConsistent(orderBook);
    });

    it('should cap the number of resting orders when maxOrderCount is set', async () => {
      orderBook = new BigOrderBook({priceDecimalPrecision: 4, maxOrderCount: 2});

      addOrder(orderBook, {id: `ask0`, price: .5, side: 'ask', size: 100});
      addOrder(orderBook, {id: `ask1`, price: .6, side: 'ask', size: 100});

      let error = captureError(() => addOrder(orderBook, {id: `ask2`, price: .7, side: 'ask', size: 100}));
      assert(error != null);
      assert(orderBook.has('ask2') === false);
      assert(orderBook.askCount === 2);

      // Market orders never rest, so they must stay available for draining a
      // book which is already at capacity.
      result = orderBook.add(makeOrder({id: `bid0`, type: 'market', side: 'bid', value: 10}));
      assert(result.takeSize === 20n);
      assert(orderBook.askCount === 2);

      orderBook.remove('ask1');
      addOrder(orderBook, {id: `ask3`, price: .7, side: 'ask', size: 100});
      assert(orderBook.has('ask3') === true);
      assertBookIsConsistent(orderBook);
    });

    it('should allow unlimited orders by default', async () => {
      for (let i = 0; i < 200; i++) {
        addOrder(orderBook, {id: `ask${i}`, price: 1 + i / 100, side: 'ask', size: 100});
      }
      assert(orderBook.askCount === 200);
      assertBookIsConsistent(orderBook);
    });
  });
});
