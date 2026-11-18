/**
 * The Help copy: plain words about the blockchain underneath, for people who have never used one.
 * Rules for editing: calm and specific, no jargon without a one-line explanation, no scare words,
 * and never claim more than the product does. Every statement here matches the contract (contracts/src/Pot.sol,
 * which has no owner, admin, pause or upgrade functions) and the app as it works today.
 */
export const HELP_TITLE = 'Splitting costs with Pot';

export const HELP_INTRO: string[] = [
  'Pot is for splitting a cost with a group, like a trip, a group order, tickets or rent. Everyone pays their share up front, so nobody has to cover the bill and wait to be paid back.',
  'Each person pays an equal share, and the money is held until everyone has paid. Then the organizer can book or buy. If the plan doesn’t fill up, everyone who paid can take their share back.',
  'Behind the scenes, Pot uses a blockchain: a shared public record that nobody can quietly edit. The money waits in a small program on that record, called a smart contract, that follows the rules you see on screen. It has no back door, so nobody, including us, can move the money outside those rules.',
  'You don’t need to know anything about crypto. Sign in with your email and Pot sets up a wallet for you. There is no seed phrase to keep and nothing to buy.',
];

export const HELP_FAQ: Array<{ question: string; answer: string }> = [
  {
    question: 'Where is my money while I wait?',
    answer:
      'In the Pot smart contract, a program on the blockchain that only does what its rules say. It isn’t in Pot’s bank account and it isn’t with the organizer. If the plan doesn’t fill by the deadline, you can take your share back.',
  },
  {
    question: 'What happens when everyone has paid?',
    answer:
      'The moment the last share comes in, the plan locks by itself, and nothing moves yet. The organizer can then ask for the money and attach a receipt, so everyone can see what it’s for. That starts a window in which anyone can object. If it ends without enough objections, the contract sends the money to the organizer. If enough people object, or the organizer never asks in time, the plan freezes and everyone can take their share back.',
  },
  {
    question: 'Do I need a crypto wallet or to buy crypto?',
    answer:
      'No. Pot creates a wallet for you when you sign in. You pay in a digital dollar called USDC, where one USDC is one US dollar.',
  },
  {
    question: 'Is there a fee?',
    answer:
      'Pot doesn’t take a cut, and neither does the contract: the full amount goes to the organizer, and a refund returns your whole share. Every payment or refund on a blockchain carries a tiny network fee. On Arc, the network Pot uses, that fee is paid in USDC too, and Pot adds a small amount to your wallet to cover it, so your share is never reduced.',
  },
  {
    question: 'What if someone doesn’t pay?',
    answer:
      'Then the plan never locks, and nobody is paid out of a half-full plan. After the deadline, everyone who paid can take their share back with one tap.',
  },
  {
    question: 'Can the organizer just take the money?',
    answer:
      'No. The organizer can only ask for the money after everyone has paid, and then you get a window to object. If enough people object, the payout freezes and everyone can get their share back.',
  },
  {
    question: 'Is this real money?',
    answer:
      'Not yet. Pot is in testing and runs on a test network with test dollars, so you can try every step without spending anything. When it uses real money, this page will say so.',
  },
];
