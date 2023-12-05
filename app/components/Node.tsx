import React from 'react'
import { Link, useLocation, useNavigate } from '@remix-run/react'
import { AiFillFolder, AiFillFile } from 'react-icons/ai'
import { MdArrowRight, MdArrowDropDown } from 'react-icons/md'
import useClickPreventionOnDoubleClick from '~/utils/doubleClick/use-click-prevention-on-double-click'
export function Node({ node, style, dragHandle, tree }) {
  const onClick = () => { console.log('you single clicked me'); return node.isInternal && node.toggle()} // prettier-ignore
  const onDoubleClick = () => {console.log('you double clicked me'); return node.toggle() } //prettier-ignore
  const [handleClick, handleDoubleClick] = useClickPreventionOnDoubleClick(onClick, onDoubleClick)

  const navigate = useNavigate()
  //a react-arborist node
  const location = useLocation()
  const romdataStars = node.data.romdataLink?.replace(/\//g, '*') //restore folder paths from url encoding
  const currentURLStars = location.pathname
  const targetURLStars = `/grid/${encodeURI(romdataStars)}`
  const onLinkClick = () => {
    console.log('you single clicked me on a link')
    return romdataStars && currentURLStars !== targetURLStars && navigate(targetURLStars)
  }
  const onLinkDoubleClick = () => {
    console.log('you double clicked me on a link')
    return node.toggle()
  }
  const [handleLinkClick, handleLinkDoubleClick] = useClickPreventionOnDoubleClick(onLinkClick, onLinkDoubleClick)
  const renderNodeText = () => (
    <span className="node-text" onClick={handleLinkClick} onDoubleClick={handleLinkDoubleClick}>
      <span>{node.data.name}</span>
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
          {node.data.iconLink ? ( //do i need this anymore?
            <img src={node.data.icon} alt="folder-icon" style={{ width: '32px', height: '32px' }} />
          ) : (
            <AiFillFolder color={node.isLeaf ? '#6bc7f6' : '#f6cf60'} />
          )}
        </span>
        {romdataStars && currentURLStars !== targetURLStars ? ( //don't navigate if we already clicked here (causes the tree to collapse)
          <span>{renderNodeText()} </span>
        ) : (
          renderNodeText()
        )}
      </div>
    </div>
  )
}
