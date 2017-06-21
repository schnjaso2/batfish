/*---
title: About
description: blah blah blah
---*/
'use strict';

const React = require('react');
const PageShell = require('../../components/page-shell');
const routeTo = require('batfish/route-to');
const AboutCss = require('./about.css');

class About extends React.Component {
  render() {
    return (
      <PageShell>
        <AboutCss />
        about

        <button
          className="btn"
          onClick={() => routeTo.prefixed('about/security/')}
        >
          Read about security
        </button>
      </PageShell>
    );
  }
}

module.exports = About;
