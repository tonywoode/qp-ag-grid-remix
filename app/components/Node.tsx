import React from 'react'
import { useLocation, useNavigate } from '@remix-run/react'
import { AiFillFolder, AiFillFile } from 'react-icons/ai'
import { MdArrowRight, MdArrowDropDown } from 'react-icons/md'
import useClickPreventionOnDoubleClick from '~/utils/doubleClick/use-click-prevention-on-double-click'

export function Node({ node, style, dragHandle }) {
  const navigate = useNavigate()
  const location = useLocation()
  const romdataStars = node.data.romdataLink?.replace(/\//g, '*')
  const currentURLStars = location.pathname
  const targetURLStars = `/grid/${encodeURI(romdataStars)}`
  const toggleNode = () => node.toggle()
  const navigateToTarget = () => romdataStars && currentURLStars !== targetURLStars && navigate(targetURLStars)
  const [handleClick, handleDoubleClick] = useClickPreventionOnDoubleClick(toggleNode, toggleNode)
  const [handleLinkClick, handleLinkDoubleClick] = useClickPreventionOnDoubleClick(navigateToTarget, toggleNode)

  const renderNodeText = () => (
    <span className="node-text" onClick={handleLinkClick} onDoubleClick={handleLinkDoubleClick}>
      {node.data.name}
    </span>
  )

  return (
    <div className="node-container" style={style} ref={dragHandle}>
      <div className="node-content" style={{ display: 'flex', alignItems: 'center' }}>
        {!node.isLeaf && (
          <span
            className="arrow"
            style={{ marginRight: '2px' }}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
          >
            {node.isOpen ? <MdArrowDropDown /> : <MdArrowRight />}
          </span>
        )}
        <span
          className="file-folder-icon"
          style={{ marginRight: '6px' }}
          onClick={handleLinkClick}
          onDoubleClick={handleLinkDoubleClick}
        >
          {node.data.iconLink ? ( //do I need this anymore?
            <img src={node.data.icon} alt="folder-icon" style={{ width: '32px', height: '32px' }} />
          ) : (
            <AiFillFolder color={node.isLeaf ? '#6bc7f6' : '#f6cf60'} />
          )}
        </span>
        {/*don't navigate if we already clicked here (causes the tree to collapse)*/}
        {romdataStars && currentURLStars !== targetURLStars ? <span>{renderNodeText()} </span> : renderNodeText()}{' '}
      </div>
    </div>
  )
}