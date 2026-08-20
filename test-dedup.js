const array = [{id: 1, c: 1}, {id: 2, c: 1}, {id: 3, c: 2}];
const unique = Array.from(new Map(array.map(item => [item.c, item])).values());
console.log(unique);
