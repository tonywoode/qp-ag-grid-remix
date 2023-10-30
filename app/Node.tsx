import { AiFillFolder, AiFillFile } from 'react-icons/ai'

const Node = ({ node, style, dragHandle, tree }) => {
  // console.log(node, tree);
  return (
    <div className="node-container" style={style} ref={dragHandle}>
      <div className="node-content" onClick={() => node.isInternal && node.toggle()}>
        {node.isLeaf ? <AiFillFile color="#6bc7f6" /> : <AiFillFolder color="#f6cf60" />}
        <span className="node-text">
          <span>{node.data.name}</span>
        </span>
      </div>
    </div>
  )
}

export { Node }
