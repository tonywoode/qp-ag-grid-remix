import React from 'react'
import { useLocation, useNavigate } from '@remix-run/react'
import { AiFillFolder } from 'react-icons/ai'
import { FaPlusSquare, FaMinusSquare } from 'react-icons/fa'
import { useRef } from 'react'
import useClickPreventionOnDoubleClick from '~/utils/doubleClick/use-click-prevention-on-double-click'
import { encodeString } from '~/utils/safeUrl'
export function Node({ node, style, dragHandle }) {
  const navigate = useNavigate()
  const location = useLocation()
  const nodeRef = useRef(null)

  const scrollIntoViewIfNeeded = () => {
    if (nodeRef.current) {
      const element = nodeRef.current
      const rect = element.getBoundingClientRect()
      const isNearBottom = rect.bottom > window.innerHeight - 100 // 100px buffer

      if (isNearBottom) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        })
      }
    }
  }

  const toggleNode = () => {
    if (node.isLeaf && node.parent) {
      node.parent.toggle()
    } else {
      node.toggle()
      // Add small delay to allow DOM update
      setTimeout(scrollIntoViewIfNeeded, 100)
    }
  }

  const [handleSingleClick, handlePreventedDoubleClick] = useClickPreventionOnDoubleClick(() => {
    const romdata = node.data.romdataLink
    const romdataEncoded = encodeString(romdata)
    if (romdata && location.pathname !== `/grid/${romdataEncoded}`) {
      navigate(`/grid/${romdataEncoded}`)
    } else {
      toggleNode()
    }
  }, toggleNode)

  return (
    <div className="node-container" style={style} ref={dragHandle}>
      <div className="node-content" style={{ display: 'flex', alignItems: 'center' }}>
        <span
          className="arrow"
          style={{ marginRight: '2px', width: '16px' }}
          onClick={node.isLeaf ? undefined : toggleNode}
          ref={nodeRef}
        >
          {!node.isLeaf &&
            (node.isOpen ? <FaMinusSquare size={12} color="silver" /> : <FaPlusSquare size={12} color="silver" />)}
        </span>
        <span
          className={`flex items-center ${node.isSelected && node.data.romdataLink ? 'bg-blue-300 text-white' : ''}`}
          style={{
            borderRadius: '4px',
            paddingRight: '8px', // Much more reasonable padding
            cursor: node.data.romdataLink ? 'pointer' : 'default'
          }}
          onClick={handleSingleClick}
          onDoubleClick={handlePreventedDoubleClick}
        >
          <span className="file-folder-icon" style={{ marginRight: '6px' }}>
            {node.data.iconLink ? (
              <img src={node.data.icon} alt="folder-icon" style={{ width: '32px', height: '32px' }} />
            ) : (
              <AiFillFolder color={node.isLeaf ? '#6bc7f6' : '#f6cf60'} />
            )}
          </span>
          <span className="node-text">{node.data.name}</span>
        </span>
      </div>
    </div>
  )
}