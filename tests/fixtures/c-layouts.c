/*
 * Reference layouts for tests/layout.test.ts. Regenerate c-layouts.json with:
 *   clang --target=x86_64-pc-linux-gnu -S -emit-llvm -o - tests/fixtures/c-layouts.c
 * and read the @out constant array (sizeof, _Alignof, then each offsetof).
 * x86_64 Linux, x86_64 Windows (MSVC) and aarch64 Linux all produce the same values.
 */
#include <stddef.h>
#include <stdint.h>
#include <stdbool.h>

typedef struct { uint8_t a; uint32_t b; uint16_t c; uint64_t d; uint8_t e; } Mixed;
typedef struct { uint8_t tag; Mixed inner; uint16_t tail[3]; } Nested;
#pragma pack(push, 2)
typedef struct { uint8_t a; uint32_t b; uint16_t c; uint64_t d; uint8_t e; } Pack2;
#pragma pack(pop)
#pragma pack(push, 4)
typedef struct { uint8_t a; uint32_t b; uint16_t c; uint64_t d; uint8_t e; } Pack4;
#pragma pack(pop)
typedef struct { bool flag; double f; char name[5]; float g; uint16_t wide[3]; int8_t s; } Misc;
#pragma pack(push, 1)
typedef struct { uint8_t a; uint32_t b; } Packed1;
#pragma pack(pop)
typedef struct { uint8_t x; Packed1 p; uint32_t y; } HoldsPacked;
typedef struct { uint8_t a; uint8_t grid[2][3]; uint32_t b; int16_t pts[2][2]; } Arrays;

#define O(S, f) (unsigned long long)offsetof(S, f)
const unsigned long long out[] = {
  sizeof(Mixed), _Alignof(Mixed), O(Mixed,a), O(Mixed,b), O(Mixed,c), O(Mixed,d), O(Mixed,e),
  sizeof(Nested), _Alignof(Nested), O(Nested,tag), O(Nested,inner), O(Nested,tail),
  sizeof(Pack2), _Alignof(Pack2), O(Pack2,a), O(Pack2,b), O(Pack2,c), O(Pack2,d), O(Pack2,e),
  sizeof(Pack4), _Alignof(Pack4), O(Pack4,a), O(Pack4,b), O(Pack4,c), O(Pack4,d), O(Pack4,e),
  sizeof(Misc), _Alignof(Misc), O(Misc,flag), O(Misc,f), O(Misc,name), O(Misc,g), O(Misc,wide), O(Misc,s),
  sizeof(HoldsPacked), _Alignof(HoldsPacked), O(HoldsPacked,x), O(HoldsPacked,p), O(HoldsPacked,y),
  sizeof(Arrays), _Alignof(Arrays), O(Arrays,a), O(Arrays,grid), O(Arrays,b), O(Arrays,pts),
};

/* Bit-field images checked in tests/layout.test.ts (c.bits). */
struct B32 { uint32_t mode : 3, flags : 5, rest : 24; };
struct B64 { uint64_t a : 30, b : 10, c : 24; };
const struct B32 b32 = { 5, 17, 3 };
const struct B64 b64 = { 0x3FFFFFFF, 0x2AB, 0x123456 };
