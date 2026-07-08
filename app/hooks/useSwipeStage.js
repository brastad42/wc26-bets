'use client'

import { useEffect, useRef, useState } from 'react'

const AXIS_LOCK_PX = 8
const AXIS_LOCK_RATIO = 2
const BOUNDARY_RESISTANCE = 0.35
const BOUNDARY_BOUNCE_TRIGGER_PX = 10
const BOUNCE_NUDGE_PX = 24
const SWIPE_TRIGGER_RATIO = 0.25
const SETTLE_MS = 280

// Swipe left/right on `containerRef` to move between `stages`, calling
// `onChangeStage` with the same function the tab-click handler uses so
// URL/localStorage sync stays in one place.
//
// Listener setup happens once on mount (via refs for the latest stages/
// activeStage/onChangeStage) rather than on every render, because dragging
// itself triggers re-renders (dragOffset changes) — re-subscribing the
// listeners mid-gesture would wipe the in-progress gesture state.
export function useSwipeStage({ containerRef, stages, activeStage, onChangeStage }) {
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [bounceEdge, setBounceEdge] = useState(null)

  const stagesRef = useRef(stages)
  const activeStageRef = useRef(activeStage)
  const onChangeStageRef = useRef(onChangeStage)

  useEffect(() => {
    stagesRef.current = stages
    activeStageRef.current = activeStage
    onChangeStageRef.current = onChangeStage
  })

  const bounceTimeouts = useRef([])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const gesture = { active: false, axis: null, startX: 0, startY: 0 }

    function clearBounceTimeouts() {
      bounceTimeouts.current.forEach(clearTimeout)
      bounceTimeouts.current = []
    }

    function prefersReducedMotion() {
      return typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    }

    function point(e) {
      if (e.touches && e.touches.length) return { x: e.touches[0].clientX, y: e.touches[0].clientY }
      if (e.changedTouches && e.changedTouches.length) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }
      return { x: e.clientX, y: e.clientY }
    }

    function boundaryInfo() {
      const idx = stagesRef.current.indexOf(activeStageRef.current)
      return { atStart: idx <= 0, atEnd: idx >= stagesRef.current.length - 1 }
    }

    function beginGesture(x, y) {
      clearBounceTimeouts()
      gesture.active = true
      gesture.axis = null
      gesture.startX = x
      gesture.startY = y
      setBounceEdge(null)
    }

    function handleMove(e) {
      if (!gesture.active) return
      const { x, y } = point(e)
      const dx = x - gesture.startX
      const dy = y - gesture.startY

      if (gesture.axis === null) {
        if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return
        gesture.axis = Math.abs(dx) > Math.abs(dy) * AXIS_LOCK_RATIO ? 'x' : 'y'
        if (gesture.axis === 'y') {
          gesture.active = false
          return
        }
        setIsDragging(true)
      }
      if (gesture.axis !== 'x') return

      if (e.cancelable) e.preventDefault()

      const { atStart, atEnd } = boundaryInfo()
      const resisted = (atStart && dx > 0) || (atEnd && dx < 0)
      setDragOffset(resisted ? dx * BOUNDARY_RESISTANCE : dx)
    }

    function endGesture(finalDx) {
      const wasHorizontal = gesture.active && gesture.axis === 'x'
      gesture.active = false
      gesture.axis = null
      setIsDragging(false)

      if (!wasHorizontal) {
        setDragOffset(0)
        return
      }

      const width = el.clientWidth || 1
      const { atStart, atEnd } = boundaryInfo()
      const goingNext = finalDx < 0
      const goingPrev = finalDx > 0
      const blocked = (goingPrev && atStart) || (goingNext && atEnd)
      const reducedMotion = prefersReducedMotion()

      if (blocked) {
        if (!reducedMotion && Math.abs(finalDx) > BOUNDARY_BOUNCE_TRIGGER_PX) {
          const edge = goingPrev ? 'start' : 'end'
          setBounceEdge(edge)
          setDragOffset(goingPrev ? BOUNCE_NUDGE_PX : -BOUNCE_NUDGE_PX)
          bounceTimeouts.current.push(setTimeout(() => setDragOffset(0), 10))
          bounceTimeouts.current.push(setTimeout(() => setBounceEdge(null), SETTLE_MS))
        } else {
          setDragOffset(0)
        }
        return
      }

      if (Math.abs(finalDx) > width * SWIPE_TRIGGER_RATIO) {
        const idx = stagesRef.current.indexOf(activeStageRef.current)
        const nextStage = stagesRef.current[goingNext ? idx + 1 : idx - 1]
        setDragOffset(0)
        onChangeStageRef.current(nextStage)
      } else {
        setDragOffset(0)
      }
    }

    function onTouchStart(e) {
      if (e.touches.length > 1) return
      if (e.target.closest?.('[data-no-swipe]')) return
      const { x, y } = point(e)
      beginGesture(x, y)
    }
    function onTouchMove(e) { handleMove(e) }
    function onTouchEnd(e) { endGesture(point(e).x - gesture.startX) }

    function onMouseMove(e) { handleMove(e) }
    function onMouseUp(e) {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      endGesture(point(e).x - gesture.startX)
    }
    function onMouseDown(e) {
      if (e.button !== 0) return
      if (e.target.closest?.('[data-no-swipe]')) return
      beginGesture(e.clientX, e.clientY)
      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('touchcancel', onTouchEnd, { passive: true })
    el.addEventListener('mousedown', onMouseDown)

    return () => {
      clearBounceTimeouts()
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
      el.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    // Runs once on mount: containerRef is a stable ref object, and
    // stages/activeStage/onChangeStage are read from refs above so the
    // listeners never need to be torn down mid-gesture.
  }, [containerRef])

  return { dragOffset, isDragging, bounceEdge }
}
