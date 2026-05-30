import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { useRef } from "react";
import useInfiniteScroll from "./useInfiniteScroll";

// Controllable IntersectionObserver mock — captures the callback so tests can
// fire intersections on demand (jsdom's default mock never fires).
let observers;
class MockIO {
  constructor(cb, opts) {
    this.cb = cb;
    this.opts = opts;
    this.elements = [];
    this.disconnected = false;
    observers.push(this);
  }
  observe(el) {
    this.elements.push(el);
  }
  unobserve() {}
  disconnect() {
    this.disconnected = true;
  }
  fire(isIntersecting = true) {
    this.cb(this.elements.map(() => ({ isIntersecting })));
  }
}

function Harness({ onLoadMore, enabled = true }) {
  const ref = useInfiniteScroll(onLoadMore, { enabled });
  return <div ref={ref} data-testid="sentinel" />;
}

function HarnessWithRoot({ onLoadMore }) {
  const rootRef = useRef(null);
  const sentinelRef = useInfiniteScroll(onLoadMore, { root: rootRef });
  return (
    <div ref={rootRef} data-testid="scroll-box">
      <div ref={sentinelRef} data-testid="sentinel" />
    </div>
  );
}

beforeEach(() => {
  observers = [];
  vi.stubGlobal("IntersectionObserver", MockIO);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useInfiniteScroll", () => {
  it("llama onLoadMore cuando el sentinel intersecta", () => {
    const onLoadMore = vi.fn();
    render(<Harness onLoadMore={onLoadMore} />);
    expect(observers).toHaveLength(1);
    observers[0].fire(true);
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("no dispara si el sentinel no está intersectando", () => {
    const onLoadMore = vi.fn();
    render(<Harness onLoadMore={onLoadMore} />);
    observers[0].fire(false);
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("no observa cuando enabled=false", () => {
    const onLoadMore = vi.fn();
    render(<Harness onLoadMore={onLoadMore} enabled={false} />);
    expect(observers).toHaveLength(0);
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("desconecta el observer al desmontar", () => {
    const onLoadMore = vi.fn();
    const { unmount } = render(<Harness onLoadMore={onLoadMore} />);
    const io = observers[0];
    unmount();
    expect(io.disconnected).toBe(true);
  });

  it("observa contra el root provisto (caja scrolleable) y no el viewport", () => {
    render(<HarnessWithRoot onLoadMore={vi.fn()} />);
    expect(observers).toHaveLength(1);
    // El root del observer es el contenedor scrolleable, no null (viewport).
    expect(observers[0].opts.root).not.toBeNull();
    expect(observers[0].opts.root.getAttribute("data-testid")).toBe(
      "scroll-box",
    );
  });
});
