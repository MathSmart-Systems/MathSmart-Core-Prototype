"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ChevronRight, MoreHorizontal } from "lucide-react";

import { caseHref } from "../utils/intervention-helpers";

/**
 * Quick actions for one queue row.
 *
 * Only transitions that need no educator-written reason are performed inline.
 * A reopen from "Resolved" always routes through the full record form, because
 * it requires a reason and a deliberate decision.
 *
 * Recording an action is a link to the case page's form rather than a second
 * way of opening what "Review" opens. The row therefore offers two things that
 * genuinely differ: read the evidence, or go and write the plan.
 *
 * @param {object} props
 * @param {object} props.item - The normalized queue row
 * @param {object} [props.filters] - The queue to carry into the case
 * @param {(interventionId: string, status: "In Progress"|"Resolved") => void} props.onQuickStatus
 * @param {boolean} [props.disabled]
 */
export function CaseRowMenu({ item, filters = null, onQuickStatus, disabled = false }) {
  const [requested, setRequested] = useState(false);
  const [coords, setCoords] = useState(null);
  // A disabled queue closes the menu beneath the pointer. Deriving the open
  // state keeps that edge from needing an effect, and the menu cannot outlive
  // the state that disabled it.
  const open = requested && !disabled;
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const status = item?.status;
  const canMarkInProgress = status === "Needs Intervention";
  // A case must be taken up before it can be resolved, which the database
  // enforces, so the row never offers a move the server would refuse.
  const canMarkResolved = status === "In Progress";

  const menuItems = useCallback(
    (root) =>
      Array.from(
        (root ?? menuRef.current)?.querySelectorAll('[role="menuitem"]') ?? [],
      ),
    []
  );

  const closeMenu = useCallback((refocus) => {
    setRequested(false);
    setCoords(null);
    if (refocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpwards = spaceBelow < 150 && rect.top > 150;
      
      setCoords({
        top: openUpwards ? rect.top - 4 : rect.bottom + 4,
        right: document.documentElement.clientWidth - rect.right,
        openUpwards,
      });
    }

    const focusFirst = () => menuItems()[0]?.focus();
    const frame = requestAnimationFrame(focusFirst);

    const handlePointerDown = (event) => {
      const clickedTrigger = rootRef.current && rootRef.current.contains(event.target);
      const clickedMenu = menuRef.current && menuRef.current.contains(event.target);
      if (!clickedTrigger && !clickedMenu) {
        closeMenu(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(true);
      }
    };

    const handleScroll = () => {
      closeMenu(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleScroll, { capture: true });
      window.removeEventListener("resize", handleScroll);
    };
  }, [open, closeMenu, menuItems]);

  const handleMenuKeyDown = (event) => {
    const items = menuItems();
    if (items.length === 0) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const index = items.indexOf(document.activeElement);
      const delta = event.key === "ArrowDown" ? 1 : -1;
      items[(index + delta + items.length) % items.length]?.focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      (event.key === "Home" ? items[0] : items[items.length - 1])?.focus();
    } else if (event.key === "Tab") {
      setRequested(false);
    }
  };

  const run = (action) => {
    // The trigger is disabled, but an already-open menu must not keep working.
    if (disabled) return;
    closeMenu(true);
    action();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? "case-row-menu" : undefined}
        aria-label={`Quick actions for ${item?.student?.full_name ?? "this learner"}`}
        onClick={() => {
          if (requested) setCoords(null);
          setRequested((current) => !current);
        }}
        disabled={disabled}
        className="inline-flex size-8 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:border-input hover:bg-muted/40 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60"
      >
        <MoreHorizontal aria-hidden="true" className="size-4" />
      </button>

      {open && coords ? createPortal(
        <div
          id="case-row-menu"
          ref={menuRef}
          role="menu"
          aria-label="Quick actions"
          onKeyDown={handleMenuKeyDown}
          style={{
            position: "fixed",
            zIndex: 50,
            right: coords.right,
            ...(coords.openUpwards ? { bottom: window.innerHeight - coords.top } : { top: coords.top }),
          }}
          className="w-52 overflow-hidden rounded-lg border border-border bg-card p-1 shadow-lg"
        >
          {canMarkInProgress ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => run(() => onQuickStatus(item.id, "In Progress"))}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-semibold text-foreground transition-colors hover:bg-muted/40"
            >
              Mark In Progress
            </button>
          ) : null}
          {canMarkResolved ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => run(() => onQuickStatus(item.id, "Resolved"))}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-semibold text-primary transition-colors hover:bg-muted/40"
            >
              Mark Resolved
            </button>
          ) : null}
          <Link
            role="menuitem"
            href={caseHref(item.id, filters, { at: "record" })}
            onClick={() => closeMenu(false)}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-semibold text-foreground transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {status === "Resolved" ? "Reopen case…" : "Record action…"}
            <ChevronRight aria-hidden="true" className="ml-auto size-3.5" />
          </Link>
        </div>,
        document.body
      ) : null}
    </div>
  );
}