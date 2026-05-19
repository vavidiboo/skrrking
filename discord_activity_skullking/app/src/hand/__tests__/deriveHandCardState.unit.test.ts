// Feature: stage6-hand-ux-improvement, deriveHandCardState State Mapping Table examples
//
// 본 unit test는 design.md "State Mapping Table"의 각 행에 대한 예제 단정을 제공한다.
// 우선순위 규칙(`legalityKnown=false → blocked` →
// `isMyTurn=false → blocked` → `isLegal=false → blocked` →
// `isResolving → resolving` → `isAnyResolving → blocked` →
// `selected` > `held` > `hovered` > `legal` > `idle`)을 한 곳에서 검증한다.
//
// _Requirements: 1.1, 1.4, 1.5, 2.3, 2.6, 3.2, 4.3, 4.5_

import { describe, it, expect } from "vitest";
import {
  deriveHandCardState,
  type HandCardInput,
} from "../deriveHandCardState";

/**
 * Baseline 입력: 모든 상위 가드(legality/turn/legal)는 통과하고 클라이언트
 * interaction 플래그는 모두 false인 상태. baseline 자체는 `legal`을 반환한다.
 * 각 case는 부분 override로 한 행만 변경하여 priority rule을 단정한다.
 */
function makeInput(overrides: Partial<HandCardInput> = {}): HandCardInput {
  return {
    cardIndex: 0,
    legalityKnown: true,
    isMyTurn: true,
    isLegal: true,
    isResolving: false,
    isAnyResolving: false,
    isSelected: false,
    isHeld: false,
    isHovered: false,
    ...overrides,
  };
}

describe("deriveHandCardState — State Mapping Table examples", () => {
  // 1. legalityKnown=false → blocked (R2.6)
  it("returns 'blocked' when legalityKnown is false", () => {
    const input = makeInput({ legalityKnown: false });
    expect(deriveHandCardState(input)).toBe("blocked");
  });

  // 2. isMyTurn=false → blocked (R3.2 변형, R4.3)
  it("returns 'blocked' when isMyTurn is false", () => {
    const input = makeInput({ isMyTurn: false });
    expect(deriveHandCardState(input)).toBe("blocked");
  });

  // 3. isLegal=false → blocked (R2.3, R3.2, R4.3)
  it("returns 'blocked' when isLegal is false", () => {
    const input = makeInput({ isLegal: false });
    expect(deriveHandCardState(input)).toBe("blocked");
  });

  // 4. isResolving=true → resolving (R1.4 top priority)
  it("returns 'resolving' when this card is the in-flight resolver", () => {
    const input = makeInput({ isResolving: true });
    expect(deriveHandCardState(input)).toBe("resolving");
  });

  // 5. self not-resolving 이지만 isAnyResolving=true → blocked (R4.5)
  it("returns 'blocked' when another card is resolving (isAnyResolving=true, isResolving=false)", () => {
    const input = makeInput({ isResolving: false, isAnyResolving: true });
    expect(deriveHandCardState(input)).toBe("blocked");
  });

  // 6. isSelected=true (그 외 client interaction false) → selected (R1.4)
  it("returns 'selected' when only isSelected is true among client interactions", () => {
    const input = makeInput({
      isSelected: true,
      isHeld: false,
      isHovered: false,
    });
    expect(deriveHandCardState(input)).toBe("selected");
  });

  // 7. isHeld=true (그 외 client interaction false) → held (R1.4, R4.2)
  it("returns 'held' when only isHeld is true among client interactions", () => {
    const input = makeInput({
      isSelected: false,
      isHeld: true,
      isHovered: false,
    });
    expect(deriveHandCardState(input)).toBe("held");
  });

  // 8. isHovered=true (그 외 client interaction false) → hovered (R1.4, R3.1)
  it("returns 'hovered' when only isHovered is true among client interactions", () => {
    const input = makeInput({
      isSelected: false,
      isHeld: false,
      isHovered: true,
    });
    expect(deriveHandCardState(input)).toBe("hovered");
  });

  // 9. 모든 client interaction false, isLegal=true → legal (R2.1)
  it("returns 'legal' when all client interactions are false and the card is legal", () => {
    const input = makeInput();
    expect(deriveHandCardState(input)).toBe("legal");
  });

  // 10. blocked fallback — multiple guard fields false 동시 → blocked (R2.3, R2.6, R4.3)
  it("returns 'blocked' as fallback when multiple guard fields fail (isMyTurn=false & isLegal=false)", () => {
    const input = makeInput({ isMyTurn: false, isLegal: false });
    expect(deriveHandCardState(input)).toBe("blocked");
  });
});

describe("deriveHandCardState — priority conflict cases", () => {
  // selected > held > hovered (R1.4): selected가 동시 활성 client interaction 중 우선
  it("prefers 'selected' when selected, held, and hovered are all true", () => {
    const input = makeInput({
      isSelected: true,
      isHeld: true,
      isHovered: true,
    });
    expect(deriveHandCardState(input)).toBe("selected");
  });

  // resolving > selected (R1.4 top priority, R3.4): isResolving이 selected를 압도
  it("prefers 'resolving' when both isResolving and isSelected are true", () => {
    const input = makeInput({ isResolving: true, isSelected: true });
    expect(deriveHandCardState(input)).toBe("resolving");
  });
});
