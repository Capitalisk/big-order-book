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

### Options

```js
let orderBook = new BigOrderBook({
  priceDecimalPrecision: 4,
  minPartialTakeSize: 0,
  minPartialTakeValue: 0,
  maxOrderCount: Infinity
});
```

- `priceDecimalPrecision`: Number of decimal places which prices are rounded to. Must be an
  integer between 0 and 15.
- `minPartialTakeSize` / `minPartialTakeValue`: A taker which could only take less than this
  from a maker declines the take; its remainder is reported back untraded instead. This stops
  a sender from using many tiny trades to deplete a counterparty offer through fixed
  blockchain transaction fees.
- `maxOrderCount`: Maximum number of orders which may rest in the book at once. Market orders
  never rest, so they can still be used to drain a book which is at capacity. Unlimited by
  default; set it if the host application does not otherwise bound how many orders it accepts.

### Order validation

`add()` rejects an order by throwing rather than storing something which cannot be matched:

- `side` must be `ask` or `bid`, and `type` must be `limit` or `market`. An unrecognized type
  is not treated as a market order.
- An ask must have a `size` and no `value`; a bid must have a `value` and no `size`. Amounts
  must be integers greater than 0, and may be given as a `BigInt`, a string or a safe integer
  `Number`. A `Number` which is too large to represent exactly is rejected rather than being
  silently rounded, so large amounts should be passed as a `BigInt` or a string.
- A limit order's `price` must be a finite number which is still greater than 0 once it has
  been rounded to `priceDecimalPrecision`, and small enough to represent at that precision.
- `sizeRemaining`, `valueRemaining`, `lastSizeTaken` and `lastValueTaken` are computed by the
  order book. They are rejected on a normal `add()` so that an order which is submitted by an
  untrusted sender cannot use them to bypass validation of `size` or `value`. Pass
  `add(order, {restore: true})` to accept them when rehydrating a trusted snapshot.

The order book keeps its own copy of each order, so `add()` does not modify the object which
was passed in, and the orders returned by `get()`, `remove()`, `getMinAsk()` and the iterators
are copies which can be modified without affecting the book.

### Matching and rounding

Two accounting guarantees hold for every call to `add()`:

- `takeSize` and `takeValue` equal the sum of the `lastSizeTaken` and `lastValueTaken` amounts
  of the returned makers, so both sides of a fill settle from the same numbers and a taker can
  be debited the take totals without ever leaving a maker over- or under-paid.
- The order's committed `size` / `value` equals the amount traded plus the returned
  `sizeRemaining` / `valueRemaining`, so none of what a sender committed is unaccounted for.

Because sizes and values are integers, a taker can be left with a remainder which is too small
to trade: below `minPartialTakeSize` / `minPartialTakeValue`, or simply too small to buy a
whole unit at the maker's price, such as 999 of value against a price of 1000. That remainder
is reported on the returned taker as `sizeRemaining` / `valueRemaining`, but the order does not
rest in the order book, so `has(id)` is `false` for it.

A remainder greater than 0 on an order which is not in the order book is therefore what the
host application should return to the sender. The same is true of a market order which runs out
of makers before it is filled. A remainder on an order which *is* in the book is a live resting
order instead, and must not be returned. The untraded remainder is bounded by the price
expressed in value units, so it stays negligible when units are chosen so that the smallest
tradable amount is far larger than the largest price.

The same rounding applies to a resting order: an ask whose remaining size is worth less than 1
of value, or a bid whose remaining value cannot buy 1 of size, can never be filled at its own
price. The matching loop skips such an order instead of handing a taker something for nothing,
and leaves it in the book as a normal order which its sender can cancel with `remove()`. This
means `getMinAsk()` and `getMaxBid()` can report a crossed spread while one is resting.

### Testing

```
npm test
```

### License

Licensed under GPLv3: http://www.gnu.org/licenses/gpl-3.0.html
