import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react'

const MAX_EDGE_LABEL = 12

export function TruncatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  style,
  markerEnd,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  const fullLabel = label != null ? String(label) : ''
  const truncated =
    fullLabel.length > MAX_EDGE_LABEL
      ? `${fullLabel.slice(0, MAX_EDGE_LABEL)}…`
      : fullLabel

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      {fullLabel && (
        <EdgeLabelRenderer>
          <div
            className="edge-label-truncated nodrag nopan"
            data-testid={`edge-label-${id}`}
            data-cycle-truncate="266"
            data-cycle-truncate-alt="338"
            data-cycle-truncate-alt2="410"
            title={fullLabel}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'all',
            }}
          >
            {truncated}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
