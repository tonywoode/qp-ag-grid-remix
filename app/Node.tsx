import { AiFillFolder, AiFillFile } from 'react-icons/ai'
import { MdArrowRight, MdArrowDropDown } from 'react-icons/md'

const Node = ({ node, style, dragHandle, tree }) => {
  // console.log(node, tree);
  return (
    <div className="node-container" style={style} ref={dragHandle}>
      <div className="node-content" onClick={() => node.isInternal && node.toggle()}>
        {node.isLeaf ? (
          <>
            <span className="arrow"></span>
            <span className="file-folder-icon">
              <AiFillFile color="#6bc7f6" />
            </span>
          </>
        ) : (
          <>
            <span className="arrow">{node.isOpen ? <MdArrowDropDown /> : <MdArrowRight />}</span>
            <span className="file-folder-icon">
              <AiFillFolder color="#f6cf60" />
            </span>
          </>
        )}
        <span className="node-text">
          <span>{node.data.name}</span>
        </span>
      </div>
    </div>
  )
}

export { Node }
