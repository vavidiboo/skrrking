// Feature: stage6-hand-ux-improvement, hand.css data-state-channels token invariants
//
// Validates: Requirements 2.2, 8.3, 8.4, 8.5
//
// 본 테스트는 task 7.1 에서 hand.css 안에 명시된 7개 상태별 비-색상 채널
// 매핑을 단정한다. 실제 attribute 부여는 HandCard.tsx (task 8.1) 가
// 담당하지만, 토큰 single source of truth 인 handStateChannels.ts 의
// invariant 만으로도 다음을 보장할 수 있다:
//
//   1. 7개 상태 각각의 토큰 배열이 비-색상 채널 2개 이상을 가진다 (R2.2, R8.3).
//   2. legal 과 blocked 의 토큰 집합이 최소 1개 채널 이상 다르다 (R2.2, R8.5).
//   3. 7개 상태 키가 정확히 모두 존재하고 다른 키는 없다 (R8.3).
//   4. 모든 토큰이 알려진 비-색상 채널 집합에 속한다 (R8.4).
//
// 추가로 hand.css 파일을 직접 읽어 7개 `.is-state-*` selector 가 모두
// 존재함을 정규식으로 확인한다 (R7.3 / R8.3 mapping 1:1 보강).

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

import {
  HAND_STATE_CHANNELS,
  HAND_NON_COLOR_CHANNELS,
} from "../handStateChannels";
import type { HandCardState } from "../deriveHandCardState";

/**
 * 7개 상태 enum 모두를 명시적으로 나열한다. handStateChannels.ts 의
 * Record 키 집합이 정확히 이 7개와 일치함을 단정하기 위한 reference set.
 */
const ALL_HAND_STATES: ReadonlyArray<HandCardState> = [
  "idle",
  "legal",
  "blocked",
  "hovered",
  "selected",
  "held",
  "resolving",
];

const KNOWN_NON_COLOR_CHANNELS = new Set<string>(HAND_NON_COLOR_CHANNELS);

/**
 * vitest jsdom env 에서도 fs / path / fileURLToPath 는 사용 가능하다.
 * import.meta.url 기준으로 hand.css 절대 경로를 해석해 cwd 의존을 피한다.
 */
function readHandCssText(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const cssPath = path.resolve(here, "..", "hand.css");
  return fs.readFileSync(cssPath, "utf8");
}

describe("hand.css data-state-channels token invariants", () => {
  it("HAND_STATE_CHANNELS 키 집합은 정확히 7개 상태와 일치한다", () => {
    const actualKeys = Object.keys(HAND_STATE_CHANNELS).sort();
    const expectedKeys = [...ALL_HAND_STATES].sort();
    expect(actualKeys).toEqual(expectedKeys);
  });

  it("각 상태는 비-색상 채널을 2개 이상 가진다 (R2.2, R8.3)", () => {
    for (const state of ALL_HAND_STATES) {
      const channels = HAND_STATE_CHANNELS[state];
      // 길이 단정: 2 이상.
      expect(
        channels.length,
        `state '${state}' must declare >= 2 non-color channels`,
      ).toBeGreaterThanOrEqual(2);

      // 배열 안 토큰 중복 금지: 동일 채널을 두 번 적어 길이를 부풀리는 것을
      // 방지한다 (Set 크기와 배열 길이가 같아야 한다).
      const uniqueChannels = new Set(channels);
      expect(
        uniqueChannels.size,
        `state '${state}' channel tokens must be unique`,
      ).toBe(channels.length);
    }
  });

  it("모든 토큰은 알려진 비-색상 채널 집합 {outline, shadow, lift, opacity} 에 속한다 (R8.4)", () => {
    for (const state of ALL_HAND_STATES) {
      for (const token of HAND_STATE_CHANNELS[state]) {
        expect(
          KNOWN_NON_COLOR_CHANNELS.has(token),
          `state '${state}' uses unknown channel token '${token}'`,
        ).toBe(true);
      }
    }
  });

  it("legal 과 blocked 토큰 집합은 최소 1개 채널 이상 다르다 (R2.2, R8.5)", () => {
    const legalSet = new Set<string>(HAND_STATE_CHANNELS.legal);
    const blockedSet = new Set<string>(HAND_STATE_CHANNELS.blocked);

    // legal 에는 있지만 blocked 에는 없는 채널.
    const onlyInLegal = HAND_STATE_CHANNELS.legal.filter(
      (c) => !blockedSet.has(c),
    );
    // blocked 에는 있지만 legal 에는 없는 채널.
    const onlyInBlocked = HAND_STATE_CHANNELS.blocked.filter(
      (c) => !legalSet.has(c),
    );

    // 최소 1개 채널 이상 차이를 가진다 (양쪽 합집합 차의 합이 1 이상).
    expect(
      onlyInLegal.length + onlyInBlocked.length,
      "legal vs blocked must differ on at least one non-color channel",
    ).toBeGreaterThanOrEqual(1);
  });

  it("hand.css 파일에 7개 `.is-state-*` selector 가 모두 존재한다 (R7.3, R8.3)", () => {
    const css = readHandCssText();

    for (const state of ALL_HAND_STATES) {
      // CSS 안에 `.is-state-<state>` selector 가 단어 경계로 등장하는지
      // 정규식으로 단정한다. 다른 식별자에 substring 매치되지 않도록
      // 뒤에 [^a-z0-9-] 또는 줄 끝/공백/콤마/중괄호 경계를 요구한다.
      const re = new RegExp(`\\.is-state-${state}(?![a-z0-9-])`, "i");
      expect(
        re.test(css),
        `hand.css must declare a .is-state-${state} selector`,
      ).toBe(true);
    }
  });
});
