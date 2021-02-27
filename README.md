# big-order-book
An efficient order book which supports market and limit orders with fast insertion and search - Works with the BigInt type.

This order book was designed with decentralized exchanges (DEXs) in mind.

### Usage

```js
const BigOrderBook = require('big-order-book');

let orderBook = new BigOrderBook();

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

let result = orderBook.add({
  id: `bid0`,
  type: 'limit',
  price: .5,
  targetChain: 'clsk',
  targetWalletAddress: '22245678912345678222L',
  senderId: '11111111111222222222L',
  side: 'bid',
  value: 10
});

console.log(result);
```

```js
{ taker:
   { id: 'bid0',
     type: 'limit',
     price: 0.5,
     targetChain: 'clsk',
     targetWalletAddress: '22245678912345678222L',
     senderId: '11111111111222222222L',
     side: 'bid',
     value: 10,
     valueRemaining: 0,
     lastSizeTaken: 0,
     lastValueTaken: 0 },
  makers:
   [ { id: 'ask0',
       type: 'limit',
       price: 0.5,
       targetChain: 'lsk',
       targetWalletAddress: '22245678912345678222L',
       senderId: '11111111111222222222L',
       side: 'ask',
       size: 100,
       sizeRemaining: 80,
       lastSizeTaken: 20,
       lastValueTaken: 10 } ],
  takeSize: 20,
  takeValue: 10 }
```

### Testing

```
npm test
```

### License

Licensed under GPLv3: http://www.gnu.org/licenses/gpl-3.0.html
