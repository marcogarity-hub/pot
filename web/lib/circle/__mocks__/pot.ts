import { defineChain, parseAbi } from 'viem';
export const arcTestnet = defineChain({ id: 5042002, name: 'Arc test fixture', nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 }, rpcUrls: { default: { http: ['http://localhost:8545'] } } });
export const potAbi = parseAbi([
 'function createPot(uint256 total,uint256 share,address[] members,uint256 deadline,uint256 threshold,uint256 objectionWindow,uint256 requestWindow) returns (uint256 potId)',
 'function pay(uint256 potId) payable', 'function finalizeRelease(uint256 potId)',
 'function refund(uint256 potId)', 'function object(uint256 potId)', 'function expire(uint256 potId)',
 'function requestRelease(uint256 potId,bytes32 receiptHash)', 'function swapSeat(uint256 potId,address leaver,address replacement)',
 'function getPot(uint256 potId) view returns ((address organizer,uint256 total,uint256 share,uint256 deadline,uint256 threshold,uint256 objectionWindow,uint256 requestWindow,uint256 lockedAt,uint8 state,uint256 paymentsCount,uint256 objectionsCount,bytes32 receiptHash,uint256 releaseEligibleAt,address[] members) pot)',
 'event PotCreated(uint256 indexed potId,address indexed organizer,address[] members,uint256 total,uint256 share,uint256 deadline,uint256 threshold,uint256 objectionWindow,uint256 requestWindow)',
 'event Paid(uint256 indexed potId,address indexed member,uint256 amount)', 'error AlreadyPaid()', 'error DeadlinePassed()',
]);
