const assert = require('assert');
const ProperOrderBook = require('../');

describe('ProperOrderBook unit tests', async () => {
  let orderBook;
  let result;
  let error;

  beforeEach(async () => {
    orderBook = new ProperOrderBook();
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

      assert(result.takeSize === 80);
      assert(result.takeValue === 40);
      assert(result.makers.length === 1);
      assert(result.makers[0].lastSizeTaken === 80);
      assert(result.makers[0].lastValueTaken === 40);
      assert(result.makers[0].sizeRemaining === 20);

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

      assert(result.takeSize === 200);
      assert(result.takeValue === 110);
      assert(result.makers.length === 2);
      assert(result.makers[0].lastSizeTaken === 100);
      assert(result.makers[0].lastValueTaken === 50);
      assert(result.makers[0].sizeRemaining === 0);
      assert(result.makers[1].lastSizeTaken === 100);
      assert(result.makers[1].lastValueTaken === 60);
      assert(result.makers[1].sizeRemaining === 0);

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

      assert(result.takeSize === 200);
      assert(result.takeValue === 110);
      assert(result.makers.length === 2);
      assert(result.makers[0].lastSizeTaken === 100);
      assert(result.makers[0].lastValueTaken === 50);
      assert(result.makers[0].sizeRemaining === 0);
      assert(result.makers[1].lastSizeTaken === 100);
      assert(result.makers[1].lastValueTaken === 60);
      assert(result.makers[1].sizeRemaining === 0);

      let iterator = orderBook.getBidIteratorFromMax();
      let bid = iterator.next().value;
      assert(bid.valueRemaining === 50);
      assert(bid.lastSizeTaken === 0);
      assert(bid.lastValueTaken === 0);
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
      assert(result.takeSize === 200);
      assert(result.takeValue === 110);
      assert(result.makers.length === 2);
      assert(result.makers[0].lastSizeTaken === 100);
      assert(result.makers[0].lastValueTaken === 60);
      assert(result.makers[0].valueRemaining === 0);
      assert(result.makers[1].lastSizeTaken === 100);
      assert(result.makers[1].lastValueTaken === 50);
      assert(result.makers[1].valueRemaining === 0);

      let iterator = orderBook.getAskIteratorFromMin();
      let ask = iterator.next().value;
      assert(ask.sizeRemaining === 50);
      assert(ask.lastSizeTaken === 0);
      assert(ask.lastValueTaken === 0);
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

      assert(result.takeSize === 200);
      assert(result.takeValue === 110);
      assert(result.taker.valueRemaining === 10);
      assert(result.taker.lastValueTaken === 0);
      assert(result.taker.lastSizeTaken === 0);

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

      assert(result.takeSize === 200);
      assert(result.takeValue === 110);
      assert(result.taker.sizeRemaining === 20);
      assert(result.taker.lastValueTaken === 0);
      assert(result.taker.lastSizeTaken === 0);

      assert([...orderBook.askList.findEntriesFromMin()].length === 0);
      assert([...orderBook.bidList.findEntriesFromMin()].length === 0);

      let allAsks = [...orderBook.getAskIteratorFromMin()];
      let allBids = [...orderBook.getBidIteratorFromMin()];
      assert(orderBook.askCount === allAsks.length);
      assert(orderBook.bidCount === allBids.length);
    });

    it('should support minimum take size', async () => {
      orderBook = new ProperOrderBook({
        minPartialTakeSize: 5.1
      });

      orderBook.add({
        id: `ask0`,
        type: 'limit',
        price: 2,
        targetChain: 'lsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'ask',
        size: 100
      });
      orderBook.add({
        id: `ask1`,
        type: 'limit',
        price: 1,
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
        value: 110
      });

      assert(result.takeSize === 100);
      assert(result.takeValue === 100);
      assert(result.makers.length === 1);
      assert(result.makers[0].lastSizeTaken === 100);
      assert(result.makers[0].lastValueTaken === 100);
      assert(result.makers[0].sizeRemaining === 0);
    });

    it('should support minimum take value', async () => {
      orderBook = new ProperOrderBook({
        minPartialTakeValue: 5.1
      });

      orderBook.add({
        id: `bid0`,
        type: 'limit',
        price: 1,
        targetChain: 'clsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'bid',
        value: 100
      });
      orderBook.add({
        id: `bid1`,
        type: 'limit',
        price: .5,
        targetChain: 'clsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'bid',
        value: 100
      });
      result = orderBook.add({
        id: `ask0`,
        type: 'market',
        targetChain: 'lsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'ask',
        size: 110
      });

      assert(result.takeSize === 100);
      assert(result.takeValue === 100);
      assert(result.makers.length === 1);
      assert(result.makers[0].lastSizeTaken === 100);
      assert(result.makers[0].lastValueTaken === 100);
      assert(result.makers[0].valueRemaining === 0);
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
          assert(askLevel.sizeRemaining === 10200);
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
        size: 2000
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

      orderBook.add({
        id: 'bid1',
        type: 'limit',
        price: 1,
        targetChain: 'clsk',
        targetWalletAddress: '22245678912345678222L',
        senderId: '11111111111222222222L',
        side: 'bid',
        value: 1
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
          assert(askLevel.sizeRemaining === 2200);
        }
      }
    });

    it('should subtract volume partially', async () => {
      orderBook.remove('ask19');
      let iterator = orderBook.getAskLevelIteratorFromMax();
      let count = 0;
      for (let askLevel of iterator) {
        if (askLevel.price === .2) {
          assert(Math.floor(askLevel.sizeRemaining * 1000) / 1000 === 2000);
        } else if (askLevel.price === .03) {
          assert(Math.floor(askLevel.sizeRemaining * 1000) / 1000 === 13.333);
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
          assert(bidLevel.valueRemaining === 3300);
        }
      }
    });

    it('should subtract volume partially', async () => {
      orderBook.remove('bid-extra');
      let iterator = orderBook.getBidLevelIteratorFromMin();
      let count = 0;
      for (let bidLevel of iterator) {
        if (bidLevel.price === .3) {
          assert(bidLevel.valueRemaining === 300);
        } else if (bidLevel.price === .9) {
          assert(bidLevel.valueRemaining === 810);
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
          assert(bidLevel.valueRemaining === 10300);
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
          assert(bidLevel.valueRemaining === 10300);
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
          price: (i + 1) / 100,
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
          price: (i + 1) / 100000,
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
