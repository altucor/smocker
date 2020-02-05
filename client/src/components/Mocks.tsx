import * as React from "react";
import classNames from "classnames";
import { UnControlled as CodeMirror, Controlled } from "react-codemirror2";
import jsyaml from "js-yaml";
import "codemirror/lib/codemirror.css";
import "codemirror/theme/material.css";
import "codemirror/addon/fold/foldgutter.css";
import "codemirror/addon/lint/lint.css";
import "codemirror/mode/javascript/javascript";
import "codemirror/mode/yaml/yaml";
import "codemirror/mode/ruby/ruby";
import "codemirror/addon/fold/foldcode";
import "codemirror/addon/fold/foldgutter";
import "codemirror/addon/fold/brace-fold";
import "codemirror/addon/fold/indent-fold";
import "codemirror/addon/fold/comment-fold";
import "codemirror/addon/lint/lint";
import "codemirror/addon/lint/yaml-lint";
import {
  formQueryParams,
  toMultimap,
  toString,
  extractMatcher,
  usePoll
} from "~utils";
import {
  Mock,
  MockResponse,
  MockDynamicResponse,
  MockRequest,
  Mocks,
  Error,
  dateFormat
} from "~modules/types";
import { connect } from "react-redux";
import { AppState } from "~modules/reducers";
import { Dispatch } from "redux";
import { Actions, actions } from "~modules/actions";
import { withRouter, RouteComponentProps } from "react-router";
import { Settings, DateTime } from "luxon";
import { Link } from "react-router-dom";
import {
  Drawer,
  Empty,
  Button,
  Icon,
  PageHeader,
  Pagination,
  Alert,
  Tag,
  Row,
  Spin,
  Form
} from "antd";
import "./Mocks.scss";

window.jsyaml = jsyaml;
Settings.defaultLocale = "en-US";

const codeMirrorOptions = {
  mode: "application/json",
  theme: "material",
  lineWrapping: true,
  readOnly: true,
  viewportMargin: Infinity,
  foldGutter: true,
  gutters: ["CodeMirror-foldgutter"]
};

const renderTimes = (count: number, expected?: number) => {
  if (!expected) {
    return <strong>{"Times: " + count}</strong>;
  }
  if (count > expected) {
    return (
      <strong>
        {"Times: "}
        <strong className="wrong">{count}</strong>/{expected}
      </strong>
    );
  }
  return <strong>{`Times: ${count}/${expected}`}</strong>;
};

const emptyResponse: any = {};

const MockResponse = ({ mock }: { mock: Mock }) => {
  const { response: resp, context, state } = mock;
  const response = resp ? resp : (emptyResponse as MockResponse);

  return (
    <div className="response">
      <div className="details">
        <Tag color="blue">{response.status || 200}</Tag>
        {renderTimes(state.times_count, context.times)}
      </div>
      {response.headers && (
        <table>
          <tbody>
            {Object.entries(response.headers).map(([key, values]) => (
              <tr key={key}>
                <td>{key}</td>
                <td>{values.join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <CodeMirror
        value={response.body ? response.body.trim() : ""}
        options={codeMirrorOptions}
      />
    </div>
  );
};

const MockDynamicResponse = ({ mock }: { mock: Mock }) => {
  const { dynamic_response, context, state } = mock;
  const response = dynamic_response
    ? dynamic_response
    : (emptyResponse as MockDynamicResponse);

  let mode;
  switch (response.engine) {
    case "lua":
      mode = "ruby"; // because lua mode doesn't handle fold
      break;
    case "go_template_json":
      mode = "application/json";
    default:
      mode = "yaml";
  }
  const options = {
    ...codeMirrorOptions,
    mode
  };
  return (
    <div className="response">
      <div className="details">
        <div className="group">
          <Tag color="blue">Engine</Tag>
          <span>
            <strong>{response.engine}</strong>
          </span>
        </div>
        {renderTimes(state.times_count, context.times)}
      </div>
      <CodeMirror value={response.script} options={options} />
    </div>
  );
};

const MockProxy = ({ mock }: { mock: Mock }) => {
  const { proxy, context, state } = mock;
  const host = proxy ? proxy.host : "";
  return (
    <div className="response">
      <div className="details">
        <div className="group">
          <Tag color="blue">Redirect To</Tag>
          <span>
            <strong>{host}</strong>
          </span>
        </div>
        {renderTimes(state.times_count, context.times)}
      </div>
    </div>
  );
};

const MockRequest = ({ request }: { request: MockRequest }) => {
  const methodMatcher = extractMatcher(request.method);
  const method = toString(request.method);
  const pathMatcher = extractMatcher(request.path);
  const path = toString(request.path);
  const bodyMatcher = extractMatcher(request.body);
  const headersMatcher = extractMatcher(request.headers);
  return (
    <div className="request">
      <div className="details">
        <div className="group">
          <Tag color="blue">
            {methodMatcher && <strong>{methodMatcher + ": "}</strong>}
            {method}
          </Tag>
          <span className="path">
            {pathMatcher && <strong>{pathMatcher + ": "}</strong>}
            {path + formQueryParams(request.query_params)}
          </span>
        </div>
      </div>
      {request.headers && (
        <table>
          <tbody>
            {Object.entries(toMultimap(request.headers)).map(
              ([key, values]) => (
                <tr key={key}>
                  <td>{key}</td>
                  <td>
                    {headersMatcher && <strong>{headersMatcher + ": "}</strong>}
                    {values.join(", ")}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      )}
      {request.body && (
        <>
          <strong className="body-matcher">
            {bodyMatcher && bodyMatcher + ": "}
          </strong>
          <CodeMirror
            value={toString(request.body)}
            options={codeMirrorOptions}
          />
        </>
      )}
    </div>
  );
};

const Mock = ({ mock }: { mock: Mock }) => {
  return (
    <div className="mock">
      <div className="meta">
        <div>
          <span className="label">ID:</span>
          <Link to={`/pages/mocks/${mock.state.id}`}>{mock.state.id}</Link>
        </div>
        <span className="date">
          {DateTime.fromISO(mock.state.creation_date).toFormat(dateFormat)}
        </span>
      </div>
      <div className="content">
        <MockRequest request={mock.request} />
        {mock.response && <MockResponse mock={mock} />}
        {mock.dynamic_response && <MockDynamicResponse mock={mock} />}
        {mock.proxy && <MockProxy mock={mock} />}
      </div>
    </div>
  );
};

const NewMock = ({
  onSave,
  onClose
}: {
  onSave: (mocks: string) => void;
  onClose: () => void;
}) => {
  const [mock, changeMock] = React.useState("");
  const handleSubmit = (event: React.MouseEvent) => {
    event.preventDefault();
    onSave(mock);
  };
  const handleCancel = (event: React.MouseEvent) => {
    event.preventDefault();
    onClose();
  };
  const handleChangeMock = (_: any, __: any, value: string) => {
    changeMock(value);
  };
  return (
    <>
      <Form className="form">
        <Controlled
          value={mock}
          options={{
            mode: "yaml",
            theme: "material",
            lineNumbers: true,
            lineWrapping: true,
            viewportMargin: Infinity,
            foldGutter: true,
            lint: true,
            gutters: [
              "CodeMirror-lint-markers",
              "CodeMirror-linenumbers",
              "CodeMirror-foldgutter"
            ]
          }}
          onBeforeChange={handleChangeMock}
        />
      </Form>
      <div className="action buttons">
        <Button onClick={handleCancel}>Cancel</Button>
        <Button onClick={handleSubmit} type="primary">
          Save
        </Button>
      </div>
    </>
  );
};

interface OwnProps {
  mock_id?: string;
}

interface Props extends RouteComponentProps<OwnProps> {
  loading: boolean;
  mocks: Mocks;
  error: Error | null;
  fetch: () => any;
  addMocks: (mocks: string) => any;
}

const Mocks = ({ match, loading, mocks, error, fetch, addMocks }: Props) => {
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [polling, togglePolling] = usePoll(fetch, 10000);
  const [displayNewMock, setDisplayNewMock] = React.useState(false);
  const ref = React.createRef<any>();
  React.useLayoutEffect(() => {
    if (ref.current) {
      ref.current.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }
  }, [page, pageSize]);
  const isEmpty = mocks.length === 0;
  let body = null;
  if (error) {
    body = <Alert message={error.message} type="error" />;
  } else if (isEmpty) {
    body = <Empty description="No mocks found." />;
  } else {
    const filteredMocks = mocks.filter(mock => {
      const mock_id = match.params.mock_id;
      return !mock_id || mock.state.id === mock_id;
    });
    const paginatedMocks = filteredMocks.slice(
      Math.max((page - 1) * pageSize, 0),
      Math.min(page * pageSize, mocks.length)
    );
    const onChangePage = (p: number) => setPage(p);
    const onChangePagSize = (p: number, ps: number) => {
      setPage(p);
      setPageSize(ps);
    };
    const pagination = (
      <Row type="flex" justify="space-between" align="middle">
        <Pagination
          hideOnSinglePage={filteredMocks.length <= 10}
          showSizeChanger
          pageSize={pageSize}
          current={page}
          onChange={onChangePage}
          onShowSizeChange={onChangePagSize}
          total={filteredMocks.length}
        />
        <Spin spinning={loading} />
      </Row>
    );
    body = (
      <>
        {pagination}
        {paginatedMocks.map(mock => (
          <Mock key={`mock-${mock.state.id}`} mock={mock} />
        ))}
        {pagination}
      </>
    );
  }

  const handleAddNewMock = () => setDisplayNewMock(true);
  const handleCancelNewMock = () => setDisplayNewMock(false);
  const handleSaveNewMock = (newMocks: string) => {
    setDisplayNewMock(false);
    addMocks(newMocks);
  };
  return (
    <div className="mocks" ref={ref}>
      <PageHeader
        title={match.params.mock_id ? "Mock" : "Mocks"}
        extra={
          !match.params.mock_id && (
            <div className="action buttons">
              <Button
                type="primary"
                icon="plus"
                disabled={displayNewMock}
                onClick={handleAddNewMock}
              >
                Add Mocks
              </Button>
              <Button
                loading={loading && { delay: 300 }}
                onClick={togglePolling}
                type={polling ? "danger" : "default"}
              >
                <Icon
                  type={polling ? "pause-circle" : "play-circle"}
                  theme={"filled"}
                />
                Autorefresh
              </Button>
            </div>
          )
        }
      >
        {match.params.mock_id ? (
          <p>
            This is the definition of the mock with ID{" "}
            <strong>{match.params.mock_id}</strong>.
          </p>
        ) : (
          <p>This is the list of declared mocks ordered by priority.</p>
        )}
        {body}
      </PageHeader>
      {displayNewMock && (
        <Drawer
          title="Add new mocks"
          placement="right"
          className="drawer"
          closable={false}
          onClose={handleCancelNewMock}
          visible={displayNewMock}
          width="70vw"
        >
          <NewMock onSave={handleSaveNewMock} onClose={handleCancelNewMock} />
        </Drawer>
      )}
    </div>
  );
};

export default withRouter(
  connect(
    (state: AppState) => ({
      loading: state.mocks.loading,
      mocks: state.mocks.list,
      error: state.mocks.error
    }),
    (dispatch: Dispatch<Actions>) => ({
      fetch: () => dispatch(actions.fetchMocks.request()),
      addMocks: (mocks: string) => dispatch(actions.addMocks.request(mocks))
    })
  )(Mocks)
);
