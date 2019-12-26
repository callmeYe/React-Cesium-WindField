import React from 'react'

function BasicLayout(props) {
  return (
    <React.Fragment>
      {props.children}
    </React.Fragment>
  );
}

export default BasicLayout;
