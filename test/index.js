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

      assert(orderBook.askList.length === 0);
      assert(orderBook.bidList.length === 0);
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

      assert(orderBook.askList.length === 0);
      assert(orderBook.bidList.length === 0);
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

      assert(orderBook.askList.length === 0);
      assert(orderBook.bidList.length === 0);
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

      assert(orderBook.askList.length === 0);
      assert(orderBook.bidList.length === 0);
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

      assert(orderBook.askList.length === 1);
      assert(orderBook.bidList.length === 1);

      result = orderBook.remove('bid0');

      assert(result != null);
      assert(result.id === 'bid0');

      assert(orderBook.askList.length === 1);
      assert(orderBook.bidList.length === 0);

      orderBook.remove('ask1');

      assert(orderBook.askList.length === 0);
      assert(orderBook.bidList.length === 0);
    });

    it('should return undefined if the order does not exist', async () => {
      result = orderBook.remove('bid111');

      assert(result === undefined);
      assert(orderBook.askList.length === 2);
      assert(orderBook.bidList.length === 1);
    });
  });

  describe('#getAskIteratorFromMin', async () => {
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

  describe('#getAskIteratorFromMax', async () => {
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
      assert(orderBook.askList.length === 0);
      assert(orderBook.bidList.length === 0);
    });
  });
});
